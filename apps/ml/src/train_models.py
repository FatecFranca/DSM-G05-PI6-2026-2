from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import psycopg
from sklearn.cluster import KMeans
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, precision_score, recall_score, silhouette_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from .settings import DATASET_SLUG, MODEL_DIRECTORY, database_url

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


def train_classifier(demand: pd.DataFrame, features: pd.DataFrame, started_on: date, ended_on: date) -> tuple[RandomForestClassifier, dict[str, object], pd.Series]:
    split_date = pd.Timestamp(started_on + (ended_on - started_on) * 2 / 3)
    past = demand[demand["demand_date"] <= split_date].groupby("product_id").agg(
        past_units=("units_sold", "sum"), past_revenue=("gross_revenue", "sum"), past_active_days=("demand_date", "nunique")
    )
    future = demand[demand["demand_date"] > split_date].groupby("product_id")["units_sold"].sum().rename("future_units")
    frame = features.set_index("product_id").join(past).join(future).fillna(0)
    threshold = float(frame["future_units"].median())
    frame["target"] = (frame["future_units"] > threshold).astype(int)
    columns = ["past_units", "past_revenue", "past_active_days", "daily_mean", "cv", "zero_ratio", "average_price"]
    x_train, x_test, y_train, y_test = train_test_split(
        frame[columns], frame["target"], test_size=0.25, random_state=RANDOM_STATE, stratify=frame["target"]
    )
    model = RandomForestClassifier(n_estimators=250, min_samples_leaf=3, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1)
    model.fit(x_train, y_train)
    prediction = model.predict(x_test)
    probabilities = pd.Series(model.predict_proba(frame[columns])[:, 1], index=frame.index)
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, prediction)), 6),
        "precision": round(float(precision_score(y_test, prediction, zero_division=0)), 6),
        "recall": round(float(recall_score(y_test, prediction, zero_division=0)), 6),
        "f1": round(float(f1_score(y_test, prediction, zero_division=0)), 6),
        "future_high_demand_threshold": threshold,
        "temporal_feature_cutoff": split_date.date().isoformat(),
        "test_products": int(len(y_test)),
    }
    return model, metrics, probabilities


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


def train_forecaster(demand: pd.DataFrame, started_on: date, ended_on: date) -> tuple[HistGradientBoostingRegressor, dict[str, object], dict[str, list[float]]]:
    top_ids = demand.groupby("product_id")["units_sold"].sum().nlargest(TOP_PRODUCTS_FOR_AI).index.tolist()
    frame = make_forecast_frame(demand, top_ids, started_on, ended_on)
    columns = ["product_code", "day_of_week", "month", "lag_1", "lag_7", "lag_14", "rolling_7", "rolling_28"]
    cutoff = pd.Timestamp(ended_on - timedelta(days=30))
    train = frame[frame["demand_date"] <= cutoff]
    test = frame[frame["demand_date"] > cutoff]
    model = HistGradientBoostingRegressor(loss="poisson", max_iter=180, max_leaf_nodes=31, learning_rate=0.08, l2_regularization=0.1, random_state=RANDOM_STATE)
    model.fit(train[columns], train["units_sold"])
    prediction = np.maximum(model.predict(test[columns]), 0)
    actual = test["units_sold"].to_numpy()
    baseline = test["lag_7"].to_numpy()
    denominator = max(float(actual.sum()), 1.0)
    metrics = {
        "mae": round(float(mean_absolute_error(actual, prediction)), 6),
        "wape": round(float(np.abs(actual - prediction).sum() / denominator), 6),
        "seasonal_naive_wape": round(float(np.abs(actual - baseline).sum() / denominator), 6),
        "validation_started_on": (cutoff + pd.Timedelta(days=1)).date().isoformat(),
        "validation_days": 30,
        "ai_products": len(top_ids),
        "training_rows": int(len(train)),
    }
    history: dict[str, list[float]] = {}
    raw = demand.groupby(["product_id", "demand_date"])["units_sold"].sum()
    for product_id in demand["product_id"].unique():
        values = raw.get(product_id, pd.Series(dtype=float))
        if isinstance(values, pd.Series):
            daily = values.reindex(pd.date_range(started_on, ended_on), fill_value=0).astype(float).tolist()
        else:
            daily = [0.0] * ((ended_on - started_on).days + 1)
        history[product_id] = daily
    top_index = {product_id: position for position, product_id in enumerate(top_ids)}
    future: dict[str, list[float]] = {product_id: [] for product_id in history}
    for offset in range(1, FORECAST_DAYS + 1):
        target = ended_on + timedelta(days=offset)
        for product_id, values in history.items():
            if product_id in top_index:
                row = pd.DataFrame([{
                    "product_code": top_index[product_id], "day_of_week": target.weekday(), "month": target.month,
                    "lag_1": values[-1], "lag_7": values[-7], "lag_14": values[-14],
                    "rolling_7": float(np.mean(values[-7:])), "rolling_28": float(np.mean(values[-28:])),
                }])
                predicted = max(float(model.predict(row[columns])[0]), 0.0)
            else:
                same_weekdays = [values[-7 * lag] for lag in range(1, 13) if len(values) >= 7 * lag]
                predicted = max(float(np.mean(same_weekdays)) if same_weekdays else 0.0, 0.0)
            values.append(predicted)
            future[product_id].append(predicted)
    return model, metrics, future


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
    cluster_run = upsert_run(connection, dataset, "clustering", "kmeans", f"kmeans-{suffix}-v1",
                             {"random_state": RANDOM_STATE, "scaled": True}, clustering_metrics, artifacts["clustering"])
    upsert_run(connection, dataset, "classification", "random-forest", f"high-demand-{suffix}-v1",
               {"random_state": RANDOM_STATE, "estimators": 250}, classification_metrics, artifacts["classification"])
    forecast_run = upsert_run(connection, dataset, "forecast", "hist-gradient-boosting", f"demand-{suffix}-v1",
                              {"random_state": RANDOM_STATE, "horizons": [7, 30, 90], "fallback": "weekday-mean"},
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
    MODEL_DIRECTORY.mkdir(parents=True, exist_ok=True)
    with psycopg.connect(database_url()) as connection:
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
            "clustering": MODEL_DIRECTORY / "clustering.joblib",
            "classification": MODEL_DIRECTORY / "classification.joblib",
            "forecast": MODEL_DIRECTORY / "forecast.joblib",
        }
        joblib.dump({"model": clustering, "scaler": scaler}, artifacts["clustering"])
        joblib.dump(classifier, artifacts["classification"])
        joblib.dump(forecaster, artifacts["forecast"])
        with connection.transaction():
            persist_results(connection, dataset, features, probabilities, artifacts, clustering_metrics,
                            classification_metrics, forecast_metrics, forecasts)
        print(json.dumps({"clustering": clustering_metrics, "classification": classification_metrics,
                          "forecast": forecast_metrics}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
