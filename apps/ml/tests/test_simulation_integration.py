import os
import unittest
from datetime import date
from uuid import uuid4

import psycopg
from psycopg import sql

from apps.ml.src.settings import REPOSITORY_ROOT, database_url
from apps.ml.src.simulate_dataset import load_demo


@unittest.skipUnless(os.getenv('ML_INTEGRATION') == '1', 'PostgreSQL integration opt-in')
class SimulationIntegrationTests(unittest.TestCase):
    def test_append_idempotency_preserves_original_and_manual_stock(self):
        with psycopg.connect(database_url(), autocommit=True, connect_timeout=10) as connection:
            # Test schema and all its contents disappear through rollback, not production deletes.
            with connection.transaction(force_rollback=True):
                schema = 'simulation_test_' + uuid4().hex
                connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
                connection.execute(sql.SQL('SET LOCAL search_path TO {}').format(sql.Identifier(schema)))
                directory = REPOSITORY_ROOT / 'infra' / 'database'
                files = ['schema.sql'] + [f'migrations/{name}' for name in [
                    '002_authentication.sql', '003_product_catalog.sql', '004_stock_movements.sql',
                    '005_warehouse_catalog.sql', '006_public_dataset.sql', '007_demo_dataset.sql']]
                for file in files:
                    connection.execute((directory / file).read_text(encoding='utf-8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''))
                original = connection.execute("""INSERT INTO dataset_versions
                  (slug,version,source_url,doi,license,file_sha256,status,period_started_on,period_ended_on,imported_at)
                  VALUES ('uci-online-retail-ii','fixture','https://example.com','test','test',repeat('a',64),'ready','2026-01-01','2026-01-01',now()) RETURNING id""").fetchone()[0]
                before = connection.execute('SELECT row_to_json(d)::text FROM dataset_versions d WHERE id=%s', (original,)).fetchone()[0]
                self.assertEqual(load_demo(connection, date(2026, 1, 3))['inserted'], 96)
                self.assertEqual(load_demo(connection, date(2026, 1, 3))['inserted'], 0)
                product = connection.execute("SELECT id FROM products WHERE sku='DEMO-001'").fetchone()[0]
                connection.execute('UPDATE inventory_levels SET on_hand_quantity=123,reserved_quantity=7 WHERE product_id=%s', (product,))
                daily_before = connection.execute('SELECT product_id,demand_date,units_sold,gross_revenue FROM daily_product_demand ORDER BY product_id,demand_date').fetchall()
                self.assertEqual(load_demo(connection, date(2026, 1, 4))['inserted'], 48)
                self.assertEqual(connection.execute('SELECT on_hand_quantity,reserved_quantity FROM inventory_levels WHERE product_id=%s', (product,)).fetchone(), (123, 7))
                self.assertEqual(before, connection.execute('SELECT row_to_json(d)::text FROM dataset_versions d WHERE id=%s', (original,)).fetchone()[0])
                self.assertEqual(daily_before, connection.execute("SELECT product_id,demand_date,units_sold,gross_revenue FROM daily_product_demand WHERE demand_date < '2026-01-04' ORDER BY product_id,demand_date").fetchall())
                self.assertEqual(connection.execute('SELECT count(*) FROM daily_product_demand').fetchone()[0], 144)
