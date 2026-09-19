from datetime import date, timedelta
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

from apps.ml.src.forecasting import recursive_forecast, seasonal_forecast, train_recursive_forecaster
from apps.ml.src.train_models import classifier_features_at, make_forecast_frame


class LagModel:
    def __init__(self):
        self.fits = []
        self.calls = 0

    def fit(self, x, y):
        self.fits.append(len(x))
        return self

    def predict(self, x):
        self.calls += 1
        return x.lag_1.to_numpy() + 1


class ForecastingTests(unittest.TestCase):
    def test_recursive_prediction_uses_own_output_and_preserves_input(self):
        model = LagModel()
        history = {"a": [2.] * 28, "b": [5.] * 28}
        output = recursive_forecast(model, history, ["a", "b"], date(2026, 1, 1), 3)
        self.assertEqual(output, {"a": [3., 4., 5.], "b": [6., 7., 8.]})
        self.assertEqual(model.calls, 3)  # batched, not one call per product
        self.assertEqual(history["a"], [2.] * 28)

    def test_baseline_repeats_last_observed_week_without_future_data(self):
        self.assertEqual(seasonal_forecast(list(range(14)), 9), [7., 8., 9., 10., 11., 12., 13., 7., 8.])

    def test_future_sales_cannot_change_classification_features(self):
        demand = pd.DataFrame([
            {"product_id": "a", "sku": "A", "name": "A", "demand_date": pd.Timestamp("2026-01-01"), "units_sold": 2., "gross_revenue": 20.},
            {"product_id": "a", "sku": "A", "name": "A", "demand_date": pd.Timestamp("2026-02-01"), "units_sold": 100., "gross_revenue": 1000.},
        ])
        before = classifier_features_at(demand, date(2026, 1, 1), date(2026, 1, 31))
        demand.loc[1, ["units_sold", "gross_revenue"]] = [1e6, 1e8]
        after = classifier_features_at(demand, date(2026, 1, 1), date(2026, 1, 31))
        pd.testing.assert_frame_equal(before, after)

    def test_validation_is_recursive_and_published_model_is_refit(self):
        start = date(2025, 1, 1)
        demand = pd.DataFrame([
            {"product_id": key, "demand_date": pd.Timestamp(start + timedelta(days=day)), "units_sold": float((day % 7) + 1)}
            for key in ["a", "b"] for day in range(120)
        ])
        model = LagModel()
        with patch('apps.ml.src.forecasting.new_regressor', return_value=model):
            artifact, metrics, future = train_recursive_forecaster(demand, start, start + timedelta(days=119), make_forecast_frame, top_products=2, days=7)
        self.assertEqual(metrics['validation_protocol'], 'fixed-origin-recursive-30d')
        self.assertEqual(metrics['selected_strategy'], 'seasonal-naive')
        self.assertEqual(metrics['seasonal_naive_wape'], 0.)
        self.assertEqual(len(model.fits), 2)
        self.assertGreater(model.fits[1], model.fits[0])
        self.assertEqual(artifact['features'][0], 'product_code')
        self.assertTrue(all(len(values) == 7 and np.isfinite(values).all() for values in future.values()))


if __name__ == '__main__':
    unittest.main()
