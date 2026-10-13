import unittest
from datetime import date
from decimal import Decimal
import pandas as pd

from apps.ml.src.simulate_dataset import catalog, generate_series
from apps.ml.src.train_models import product_features


class SimulationTests(unittest.TestCase):
    def test_explicit_zero_days_do_not_count_as_active_sales(self):
        demand = pd.DataFrame({'product_id': ['a', 'a'], 'sku': ['A', 'A'], 'name': ['A', 'A'],
                               'demand_date': pd.to_datetime(['2026-01-01', '2026-01-02']),
                               'units_sold': [4, 0], 'gross_revenue': [40, 0]})
        full = product_features(demand, 3).iloc[0]
        sparse = product_features(demand.iloc[:1], 3).iloc[0]
        self.assertAlmostEqual(full.zero_ratio, 2 / 3)
        self.assertAlmostEqual(full.zero_ratio, sparse.zero_ratio)
        self.assertAlmostEqual(full.daily_std, sparse.daily_std)

    def test_extension_preserves_existing_days(self):
        start = date(2026, 1, 1)
        first = list(generate_series(3, start, date(2026, 1, 10)))
        extended = list(generate_series(3, start, date(2026, 1, 20)))
        self.assertEqual(first, extended[:10])
        self.assertEqual(extended, list(generate_series(3, start, date(2026, 1, 20))))

    def test_every_day_present_nonnegative_and_no_shared_series(self):
        first = list(generate_series(0, date(2024, 2, 1), date(2024, 3, 1)))
        second = list(generate_series(1, date(2024, 2, 1), date(2024, 3, 1)))
        self.assertEqual(len(first), 30)
        self.assertTrue(all(isinstance(quantity, int) and quantity >= 0 for _, quantity in first))
        self.assertNotEqual(first, second)

    def test_catalog_has_explicit_synthetic_identity_and_decimal_prices(self):
        products = list(catalog())
        self.assertEqual(len(products), 48)
        self.assertEqual(len({sku for _, sku, _, _ in products}), 48)
        self.assertTrue(all('simulado' in name and isinstance(price, Decimal) and price > 0 for _, _, name, price in products))

    def test_invalid_period(self):
        with self.assertRaises(ValueError):
            list(generate_series(0, date(2026, 2, 1), date(2026, 1, 1)))
