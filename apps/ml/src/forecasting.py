"""Recursive demand forecasting with an explicit, chronological validation window."""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

FEATURES = ["product_code", "day_of_week", "month", "lag_1", "lag_7", "lag_14", "rolling_7", "rolling_28"]


def daily_history(demand: pd.DataFrame, product_ids: list[str], start: date, end: date) -> dict[str, list[float]]:
    calendar = pd.date_range(start, end)
    raw = demand.groupby(["product_id", "demand_date"])["units_sold"].sum()
    return {product_id: raw.get(product_id, pd.Series(dtype=float)).reindex(calendar, fill_value=0).astype(float).tolist()
            for product_id in product_ids}


def seasonal_forecast(values: list[float], days: int) -> list[float]:
    """Fixed-origin weekly baseline: never consumes observed validation targets."""
    if len(values) < 7:
        raise ValueError("São necessários pelo menos sete dias de histórico.")
    return [max(float(values[-7 + offset % 7]), 0.0) for offset in range(days)]


def recursive_forecast(model, histories: dict[str, list[float]], product_ids: list[str], end: date, days: int) -> dict[str, list[float]]:
    """One batched prediction per day; feedback contains predictions, not future sales."""
    history = {key: list(histories[key]) for key in product_ids}
    if any(len(values) < 28 for values in history.values()):
        raise ValueError("São necessários pelo menos 28 dias para as variáveis atrasadas.")
    future = {key: [] for key in product_ids}
    for offset in range(1, days + 1):
        target = end + timedelta(days=offset)
        rows = [{"product_code": code, "day_of_week": target.weekday(), "month": target.month,
                 "lag_1": history[key][-1], "lag_7": history[key][-7], "lag_14": history[key][-14],
                 "rolling_7": float(np.mean(history[key][-7:])), "rolling_28": float(np.mean(history[key][-28:]))}
                for code, key in enumerate(product_ids)]
        predicted = np.maximum(model.predict(pd.DataFrame(rows)[FEATURES]), 0)
        if not np.all(np.isfinite(predicted)):
            raise ValueError("O modelo retornou previsões não finitas.")
        for key, value in zip(product_ids, predicted, strict=True):
            history[key].append(float(value))
            future[key].append(float(value))
    return future


def new_regressor() -> HistGradientBoostingRegressor:
    # Internal random early-stopping would not respect chronological validation.
    return HistGradientBoostingRegressor(loss="poisson", max_iter=180, max_leaf_nodes=31,
        learning_rate=.08, l2_regularization=.1, random_state=42, early_stopping=False)


def train_recursive_forecaster(demand: pd.DataFrame, start: date, end: date, make_frame,
                              top_products: int = 200, days: int = 90):
    if (end - start).days < 90:
        raise ValueError("Treinamento requer pelo menos 91 dias de histórico.")
    cutoff = end - timedelta(days=30)
    past = demand[demand.demand_date <= pd.Timestamp(cutoff)]
    # Product selection also uses training data only.
    product_ids = past.groupby("product_id").units_sold.sum().nlargest(top_products).index.tolist()
    if not product_ids or float(past.units_sold.sum()) <= 0:
        raise ValueError("Não há demanda positiva suficiente para treinar.")
    frame = make_frame(demand, product_ids, start, end)
    train = frame[frame.demand_date <= pd.Timestamp(cutoff)]
    model = new_regressor()
    model.fit(train[FEATURES], train.units_sold)
    history = daily_history(past, product_ids, start, cutoff)
    predicted = recursive_forecast(model, history, product_ids, cutoff, 30)
    naive = {key: seasonal_forecast(history[key], 30) for key in product_ids}
    observed = daily_history(demand, product_ids, cutoff + timedelta(days=1), end)
    actual = np.array([observed[key] for key in product_ids])
    predicted_array = np.array([predicted[key] for key in product_ids])
    baseline_array = np.array([naive[key] for key in product_ids])
    residual = np.abs(actual - predicted_array)
    baseline_residual = np.abs(actual - baseline_array)
    denominator = max(float(actual.sum()), 1.0)
    selected = "hist-gradient-boosting" if residual.mean() <= baseline_residual.mean() else "seasonal-naive"
    selected_residual = residual if selected == "hist-gradient-boosting" else baseline_residual
    metrics = {
        "mae": round(float(selected_residual.mean()), 6),
        "wape": round(float(selected_residual.sum() / denominator), 6),
        "ai_mae": round(float(residual.mean()), 6),
        "ai_wape": round(float(residual.sum() / denominator), 6),
        "seasonal_naive_wape": round(float(baseline_residual.sum() / denominator), 6),
        "selected_strategy": selected,
        "validation_protocol": "fixed-origin-recursive-30d",
        "validation_started_on": (cutoff + timedelta(days=1)).isoformat(),
        "validation_days": 30, "ai_products": len(product_ids),
        "training_rows": int(len(train)), "refit_rows": int(len(frame)),
        "refit_ended_on": end.isoformat(),
        "selection_metrics_not_independent_test": True,
    }
    # Publish a model refit through the last observed day, not one frozen before validation.
    model.fit(frame[FEATURES], frame.units_sold)
    all_ids = sorted(demand.product_id.unique().tolist())
    full_history = daily_history(demand, all_ids, start, end)
    future = {key: seasonal_forecast(full_history[key], days) for key in all_ids}
    if selected == "hist-gradient-boosting":
        future.update(recursive_forecast(model, full_history, product_ids, end, days))
    artifact = {"schema_version": 2, "model": model, "features": FEATURES,
                "product_ids": product_ids, "selected_strategy": selected,
                "fallback": "seasonal-naive", "training_ended_on": end.isoformat()}
    return artifact, metrics, future
