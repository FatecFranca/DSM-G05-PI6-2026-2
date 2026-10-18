from datetime import datetime
import unittest

import numpy as np
import pandas as pd

from apps.ml.src.preprocessing_study import preprocess, evaluate, select_attributes, FeatureSubset
from apps.ml.src.forecasting import FEATURES
from apps.ml.src.train_models import make_forecast_frame


class PreprocessingStudyTests(unittest.TestCase):
    def test_cleaning_is_exclusive_and_preserves_sales_without_customer(self):
        good = ('1', 'a', 'Produto', 2, datetime(2011, 1, 1), 3, None, 'UK')
        rows = [good, good, ('C1', 'a', None, -2, good[4], 0, None, 'UK'),
                ('2', 'b', 'Item', 0, good[4], 3, None, 'UK'),
                ('3', 'b', '', 1, good[4], 3, None, 'UK'),
                ('4', 'POST', 'Frete', 1, good[4], 3, None, 'UK'),
                ('5', 'a', 'Item', float('nan'), good[4], 3, None, 'UK')]
        demand, counts, missing, _ = preprocess(rows)
        self.assertEqual(counts['accepted'], 1)
        self.assertEqual(counts['rejected'], 6)
        self.assertEqual(sum(counts[k] for k in ['duplicate', 'cancellation', 'nonpositive', 'missing_description', 'non_product', 'malformed']), 6)
        self.assertEqual(missing['Customer ID'], 7)
        self.assertEqual(demand.iloc[0].units_sold, 2)
        self.assertNotIn('Customer ID', demand.columns)

    def test_lags_never_include_current_target(self):
        days = pd.date_range('2011-01-01', periods=60)
        raw = pd.DataFrame({'product_id': 'a', 'demand_date': days, 'units_sold': np.arange(60.)})
        frame = make_forecast_frame(raw, ['a'], days[0].date(), days[-1].date())
        self.assertEqual(frame.iloc[0].lag_1, 27)
        self.assertEqual(frame.iloc[0].rolling_28, 13.5)
        self.assertEqual(frame.iloc[0].units_sold, 28)

    def test_selection_is_deterministic_and_uses_only_given_training_frame(self):
        rng = np.random.default_rng(42)
        train = pd.DataFrame(rng.normal(size=(120, len(FEATURES))), columns=FEATURES)
        train[FEATURES[:3]] = np.tile([1, 2, 3], (len(train), 1))
        train['units_sold'] = train.lag_1 * 3 + rng.normal(size=len(train))
        selected, scores = select_attributes(train)
        again, _ = select_attributes(train)
        self.assertEqual(selected, again)
        self.assertEqual(len(selected), 4)
        self.assertIn('lag_1', selected)
        self.assertEqual(set(scores), set(FEATURES))

    def test_metrics_and_feature_adapter(self):
        self.assertEqual(evaluate(np.array([1., 3.]), np.array([2., 2.]))['wape_pct'], 50)
        self.assertIsNone(evaluate(np.array([0.]), np.array([0.]))['wape_pct'])
        class Model:
            def predict(self, frame):
                self.columns = frame.columns.tolist()
                return frame.iloc[:, 0].to_numpy()
        model = Model()
        FeatureSubset(model, ['lag_1']).predict(pd.DataFrame({'lag_1': [2.], 'month': [1]}))
        self.assertEqual(model.columns, ['lag_1'])
