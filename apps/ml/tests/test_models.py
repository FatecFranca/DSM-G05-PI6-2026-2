from __future__ import annotations

import unittest

import pandas as pd

from apps.ml.src.train_models import product_features, train_clustering


class ProductFeatureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.demand = pd.DataFrame([
            {"product_id": "a", "sku": "A", "name": "Produto A", "demand_date": pd.Timestamp("2024-01-01"), "units_sold": 10.0, "gross_revenue": 100.0},
            {"product_id": "a", "sku": "A", "name": "Produto A", "demand_date": pd.Timestamp("2024-01-02"), "units_sold": 10.0, "gross_revenue": 100.0},
            {"product_id": "b", "sku": "B", "name": "Produto B", "demand_date": pd.Timestamp("2024-01-01"), "units_sold": 2.0, "gross_revenue": 4.0},
            {"product_id": "c", "sku": "C", "name": "Produto C", "demand_date": pd.Timestamp("2024-01-03"), "units_sold": 1.0, "gross_revenue": 1.0},
            {"product_id": "d", "sku": "D", "name": "Produto D", "demand_date": pd.Timestamp("2024-01-04"), "units_sold": 1.0, "gross_revenue": 1.0},
        ])

    def test_calculates_abc_and_zero_days_without_materializing_grid(self) -> None:
        result = product_features(self.demand, total_days=10).set_index("product_id")
        self.assertEqual(result.loc["a", "abc_class"], "A")
        self.assertEqual(result.loc["c", "abc_class"], "C")
        self.assertAlmostEqual(result.loc["a", "zero_ratio"], 0.8)
        self.assertAlmostEqual(result.loc["b", "average_price"], 2.0)

    def test_clustering_is_reproducible(self) -> None:
        first = product_features(self.demand, total_days=10)
        second = product_features(self.demand, total_days=10)
        _, _, first_metrics = train_clustering(first)
        _, _, second_metrics = train_clustering(second)
        self.assertEqual(first_metrics, second_metrics)
        self.assertListEqual(first["cluster_label"].tolist(), second["cluster_label"].tolist())


if __name__ == "__main__":
    unittest.main()
