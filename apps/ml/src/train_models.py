from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import psycopg
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, silhouette_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from .settings import DATASET_SLUG, MODEL_DIRECTORY, database_url
from .forecasting import train_recursive_forecaster

RANDOM_STATE = 42
FORECAST_DAYS = 90
TOP_PRODUCTS_FOR_AI = 200


@dataclass(frozen=True)
class DatasetVersion:
    id: str
    version: str
    started_on: date
    ended_on: date


def json_value(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, default=lambda item: item.item() if hasattr(item, "item") else str(item))


def load_dataset(connection: psycopg.Connection) -> tuple[DatasetVersion, pd.DataFrame]:
    row = connection.execute(
        """SELECT id::text,version,period_started_on,period_ended_on
           FROM dataset_versions WHERE slug=%s AND status='ready'
           ORDER BY imported_at DESC NULLS LAST LIMIT 1""",
        (DATASET_SLUG,),
    ).fetchone()
    if not row:
        raise RuntimeError("A base ainda não foi carregada. Execute npm run data:load.")
    dataset = DatasetVersion(*row)
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT d.product_id::text,p.sku,p.name,d.demand_date,d.units_sold::float8 AS units_sold,
                      d.gross_revenue::float8 AS gross_revenue
               FROM daily_product_demand d JOIN products p ON p.id=d.product_id
               WHERE d.dataset_version_id=%s
               ORDER BY d.product_id,d.demand_date""",
            (dataset.id,),
        )
        demand = pd.DataFrame(cursor.fetchall(), columns=[column.name for column in cursor.description])
    demand["demand_date"] = pd.to_datetime(demand["demand_date"])
    if demand.empty:
        raise RuntimeError("A série diária está vazia.")
    return dataset, demand


def product_features(demand: pd.DataFrame, total_days: int) -> pd.DataFrame:
    grouped = demand.groupby(["product_id", "sku", "name"], as_index=False).agg(
        total_units=("units_sold", "sum"),
        revenue=("gross_revenue", "sum"),
        active_days=("demand_date", "nunique"),
        daily_mean_active=("units_sold", "mean"),
        daily_std_active=("units_sold", "std"),
        average_price=("gross_revenue", lambda values: float(values.sum())),
    )
    grouped["daily_mean"] = grouped["total_units"] / total_days
    # Variância incluindo dias sem venda, sem criar uma matriz produto × dia gigante.
    sum_squares = demand.assign(square=demand["units_sold"] ** 2).groupby("product_id")["square"].sum()
    grouped["daily_std"] = grouped.apply(
        lambda row: np.sqrt(max((sum_squares[row.product_id] / total_days) - row.daily_mean ** 2, 0)), axis=1
    )
    grouped["cv"] = grouped["daily_std"] / grouped["daily_mean"].replace(0, np.nan)
    grouped["cv"] = grouped["cv"].replace([np.inf, -np.inf], np.nan).fillna(99).clip(upper=99)
    grouped["zero_ratio"] = 1 - grouped["active_days"] / total_days
    grouped["average_price"] = grouped["revenue"] / grouped["total_units"].replace(0, np.nan)
    grouped["average_price"] = grouped["average_price"].fillna(0)
    ordered = grouped.sort_values("revenue", ascending=False).copy()
    total_revenue = max(float(ordered["revenue"].sum()), 1.0)
    ordered["prior_revenue_share"] = (ordered["revenue"].cumsum() - ordered["revenue"]) / total_revenue
    ordered["abc_class"] = np.select(
        [ordered["prior_revenue_share"] < 0.80, ordered["prior_revenue_share"] < 0.95], ["A", "B"], default="C"
    )
    ordered["xyz_class"] = np.select(
        [(ordered["cv"] <= 0.5) & (ordered["zero_ratio"] <= 0.5),
         (ordered["cv"] <= 1.0) & (ordered["zero_ratio"] <= 0.75)], ["X", "Y"], default="Z"
    )
    return ordered


def train_clustering(features: pd.DataFrame) -> tuple[KMeans, StandardScaler, dict[str, object]]:
    columns = ["total_units", "revenue", "daily_mean", "cv", "zero_ratio", "average_price"]
    values = features[columns].copy()
    values[["total_units", "revenue", "daily_mean", "average_price"]] = np.log1p(
        values[["total_units", "revenue", "daily_mean", "average_price"]]
    )
    scaler = StandardScaler()
    scaled = scaler.fit_transform(values)
    best: tuple[float, KMeans] | None = None
    candidates: dict[str, float] = {}
    for clusters in range(2, min(7, len(features))):
        model = KMeans(n_clusters=clusters, n_init=20, random_state=RANDOM_STATE)
        labels = model.fit_predict(scaled)
        score = float(silhouette_score(scaled, labels, sample_size=min(3000, len(labels)), random_state=RANDOM_STATE))
        candidates[str(clusters)] = round(score, 6)
        if best is None or score > best[0]:
            best = score, model
    if best is None:
        raise RuntimeError("Produtos insuficientes para agrupamento.")
    features["cluster_label"] = [f"cluster-{label + 1}" for label in best[1].labels_]
    return best[1], scaler, {"silhouette": round(best[0], 6), "candidates": candidates, "clusters": best[1].n_clusters}


CLASSIFIER_FEATURES = ["daily_mean", "cv", "zero_ratio", "average_price"]


def classifier_features_at(demand: pd.DataFrame, started_on: date, cutoff: date) -> pd.DataFrame:
    past = demand[demand["demand_date"] <= pd.Timestamp(cutoff)]
    return product_features(past, (cutoff - started_on).days + 1).set_index("product_id")


def train_classifier(demand: pd.DataFrame, features: pd.DataFrame, started_on: date, ended_on: date):
    cutoff = started_on + (ended_on - started_on) * 2 / 3
    past_features = classifier_features_at(demand, started_on, cutoff)
    if len(past_features) < 8:
        raise ValueError("A classificação requer pelo menos oito produtos com histórico anterior ao corte.")
    future_days = max((ended_on - cutoff).days, 1)
    future = demand[demand["demand_date"] > pd.Timestamp(cutoff)].groupby("product_id").units_sold.sum()
    frame = past_features.join((future / future_days).rename("future_daily_mean")).fillna(0)
    train_ids, test_ids = train_test_split(frame.index, test_size=.25, random_state=RANDOM_STATE)
    # The label threshold is derived from training products' PAST, not test labels.
    threshold = float(frame.loc[train_ids, "daily_mean"].median())
    target = (frame.future_daily_mean > threshold).astype(int)
    model = RandomForestClassifier(n_estimators=250, min_samples_leaf=3,
        class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1)
    model.fit(frame.loc[train_ids, CLASSIFIER_FEATURES], target.loc[train_ids])
    prediction = model.predict(frame.loc[test_ids, CLASSIFIER_FEATURES])
    metrics = {
        "accuracy": round(float(accuracy_score(target.loc[test_ids], prediction)), 6),
        "precision": round(float(precision_score(target.loc[test_ids], prediction, zero_division=0)), 6),
        "recall": round(float(recall_score(target.loc[test_ids], prediction, zero_division=0)), 6),
        "f1": round(float(f1_score(target.loc[test_ids], prediction, zero_division=0)), 6),
        "high_demand_daily_threshold": threshold,
        "temporal_feature_cutoff": cutoff.isoformat(),
        "validation_protocol": "held-out-products-with-past-only-features",
        "test_products": int(len(test_ids)),
        "not_a_temporal_forecast_accuracy": True,
    }
    model.fit(frame[CLASSIFIER_FEATURES], target)
    current = features.set_index("product_id")[CLASSIFIER_FEATURES]
    probabilities = model.predict_proba(current)
    positive = list(model.classes_).index(1) if 1 in model.classes_ else None
    values = probabilities[:, positive] if positive is not None else np.zeros(len(current))
    artifact = {"schema_version": 2, "model": model, "features": CLASSIFIER_FEATURES,
                "high_demand_daily_threshold": threshold, "feature_cutoff": cutoff.isoformat()}
    return artifact, metrics, pd.Series(values, index=current.index)


def make_forecast_frame(demand: pd.DataFrame, product_ids: list[str], started_on: date, ended_on: date) -> pd.DataFrame:
    calendar = pd.date_range(started_on, ended_on, freq="D")
    index = pd.MultiIndex.from_product([product_ids, calendar], names=["product_id", "demand_date"])
    frame = demand[demand["product_id"].isin(product_ids)].set_index(["product_id", "demand_date"])["units_sold"].reindex(index, fill_value=0).reset_index()
    frame["product_code"] = pd.Categorical(frame["product_id"], categories=product_ids).codes
    frame["day_of_week"] = frame["demand_date"].dt.dayofweek
    frame["month"] = frame["demand_date"].dt.month
    grouped = frame.groupby("product_id")["units_sold"]
    frame["lag_1"] = grouped.shift(1)
    frame["lag_7"] = grouped.shift(7)
    frame["lag_14"] = grouped.shift(14)
    frame["rolling_7"] = grouped.transform(lambda values: values.shift(1).rolling(7).mean())
    frame["rolling_28"] = grouped.transform(lambda values: values.shift(1).rolling(28).mean())
    return frame.dropna().reset_index(drop=True)


def train_forecaster(demand: pd.DataFrame, started_on: date, ended_on: date):
    return train_recursive_forecaster(demand, started_on, ended_on, make_forecast_frame,
                                     top_products=TOP_PRODUCTS_FOR_AI, days=FORECAST_DAYS)


def upsert_run(connection: psycopg.Connection, dataset: DatasetVersion, task: str, algorithm: str,
               version: str, parameters: dict[str, object], metrics: dict[str, object], artifact: Path) -> str:
    return connection.execute(
        """INSERT INTO model_runs(task,algorithm,model_version,status,training_started_on,training_ended_on,
             parameters,metrics,artifact_uri,started_at,finished_at,dataset_version_id)
           VALUES(%s,%s,%s,'succeeded',%s,%s,%s::jsonb,%s::jsonb,%s,now(),now(),%s)
           ON CONFLICT(task,model_version) DO UPDATE SET algorithm=excluded.algorithm,status='succeeded',
             training_started_on=excluded.training_started_on,training_ended_on=excluded.training_ended_on,
             parameters=excluded.parameters,metrics=excluded.metrics,artifact_uri=excluded.artifact_uri,
             started_at=excluded.started_at,finished_at=excluded.finished_at,dataset_version_id=excluded.dataset_version_id
           RETURNING id::text""",
        (task, algorithm, version, dataset.started_on, dataset.ended_on, json_value(parameters), json_value(metrics),
         artifact.as_posix(), dataset.id),
    ).fetchone()[0]


def persist_results(connection: psycopg.Connection, dataset: DatasetVersion, features: pd.DataFrame,
                    probabilities: pd.Series, artifacts: dict[str, Path], clustering_metrics: dict[str, object],
                    classification_metrics: dict[str, object], forecast_metrics: dict[str, object],
                    forecasts: dict[str, list[float]]) -> None:
    suffix = dataset.version.replace("_", "-")
    cluster_run = upsert_run(connection, dataset, "clustering", "kmeans", f"kmeans-{suffix}-v2",
                             {"random_state": RANDOM_STATE, "scaled": True}, clustering_metrics, artifacts["clustering"])
    upsert_run(connection, dataset, "classification", "random-forest", f"high-demand-{suffix}-v2",
               {"random_state": RANDOM_STATE, "estimators": 250}, classification_metrics, artifacts["classification"])
    forecast_run = upsert_run(connection, dataset, "forecast", str(forecast_metrics["selected_strategy"]), f"demand-{suffix}-v2",
                              {"random_state": RANDOM_STATE, "horizons": [7, 30, 90], "fallback": "seasonal-naive", "validation": "fixed-origin-recursive", "bounds": "heuristic-not-calibrated"},
                              forecast_metrics, artifacts["forecast"])
    connection.execute("DELETE FROM product_analyses WHERE model_run_id=%s", (cluster_run,))
    analysis_rows = []
    for row in features.itertuples(index=False):
        payload = {
            "total_units": round(float(row.total_units), 4), "revenue": round(float(row.revenue), 2),
            "daily_mean": round(float(row.daily_mean), 6), "cv": round(float(row.cv), 6),
            "zero_ratio": round(float(row.zero_ratio), 6), "average_price": round(float(row.average_price), 4),
            "high_demand_probability": round(float(probabilities.get(row.product_id, 0)), 6),
        }
        analysis_rows.append((row.product_id, cluster_run, row.abc_class, row.xyz_class, row.cluster_label, json_value(payload)))
    with connection.cursor() as cursor:
        cursor.executemany(
            """INSERT INTO product_analyses(product_id,model_run_id,abc_class,xyz_class,cluster_label,features,analyzed_at)
               VALUES(%s,%s,%s,%s,%s,%s::jsonb,now())""", analysis_rows)
    connection.execute("DELETE FROM demand_forecasts WHERE model_run_id=%s", (forecast_run,))
    error = max(float(forecast_metrics["mae"]), 0.1) * 1.28
    connection.execute("""CREATE TEMP TABLE forecast_stage(
      product_id uuid,target_date date,horizon_days integer,predicted numeric(14,4),lower numeric(14,4),upper numeric(14,4)
    ) ON COMMIT DROP""")
    with connection.cursor().copy("COPY forecast_stage FROM STDIN") as copy:
        for product_id, values in forecasts.items():
            for horizon in (7, 30, 90):
                for offset, predicted in enumerate(values[:horizon], start=1):
                    copy.write_row((product_id, dataset.ended_on + timedelta(days=offset), horizon,
                                    round(predicted, 4), round(max(predicted - error, 0), 4), round(predicted + error, 4)))
    connection.execute(
        """INSERT INTO demand_forecasts(product_id,model_run_id,generated_at,target_date,horizon_days,predicted_quantity,lower_bound,upper_bound)
           SELECT product_id,%s,now(),target_date,horizon_days,predicted,lower,upper FROM forecast_stage""", (forecast_run,))


def main() -> None:
    parser = argparse.ArgumentParser(description="Treina modelos sobre o histórico identificado da base.")
    parser.add_argument("--evaluate-only", action="store_true", help="Grava artefatos e métricas, sem publicar no banco.")
    args = parser.parse_args()
    artifact_directory = MODEL_DIRECTORY / ("evaluation-v2" if args.evaluate_only else "v2")
    artifact_directory.mkdir(parents=True, exist_ok=True)
    with psycopg.connect(database_url(), connect_timeout=10) as connection:
        if args.evaluate_only:
            connection.execute("SET TRANSACTION READ ONLY")
        dataset, demand = load_dataset(connection)
        days = (dataset.ended_on - dataset.started_on).days + 1
        features = product_features(demand, days)
        print(f"Treinando agrupamento para {len(features):,} produtos...")
        clustering, scaler, clustering_metrics = train_clustering(features)
        print("Treinando classificação supervisionada de alta demanda...")
        classifier, classification_metrics, probabilities = train_classifier(
            demand, features, dataset.started_on, dataset.ended_on
        )
        print("Treinando previsão e validando contra baseline sazonal...")
        forecaster, forecast_metrics, forecasts = train_forecaster(demand, dataset.started_on, dataset.ended_on)
        artifacts = {
            "clustering": artifact_directory / "clustering.joblib",
            "classification": artifact_directory / "classification.joblib",
            "forecast": artifact_directory / "forecast.joblib",
        }
        joblib.dump({"model": clustering, "scaler": scaler}, artifacts["clustering"])
        joblib.dump(classifier, artifacts["classification"])
        joblib.dump(forecaster, artifacts["forecast"])
        if not args.evaluate_only:
            with connection.transaction():
                persist_results(connection, dataset, features, probabilities, artifacts, clustering_metrics,
                                classification_metrics, forecast_metrics, forecasts)
        report = {"dataset_version": dataset.version, "period_end": dataset.ended_on.isoformat(),
                  "published": not args.evaluate_only, "clustering": clustering_metrics,
                  "classification": classification_metrics, "forecast": forecast_metrics}
        (artifact_directory / "metrics.json").write_text(json_value(report), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
