INSERT INTO categories (id, external_id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'cat-mercearia', 'Mercearia'),
  ('10000000-0000-4000-8000-000000000002', 'cat-laticinios', 'Laticínios'),
  ('10000000-0000-4000-8000-000000000003', 'cat-limpeza', 'Limpeza')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

INSERT INTO suppliers (id, external_id, name) VALUES
  ('11000000-0000-4000-8000-000000000001', 'fornecedor-demo-1', 'Distribuidora Modelo')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

INSERT INTO warehouses (id, external_id, name) VALUES
  ('30000000-0000-4000-8000-000000000001', 'deposito-principal', 'Depósito principal')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

INSERT INTO products (
  id, external_id, sku, name, category_id, supplier_id, unit,
  cost_price, sale_price, lead_time_days, minimum_stock
) VALUES
  ('20000000-0000-4000-8000-000000000001', 'produto-cafe', 'CAF-500-TD', 'Café Torrado 500 g', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'UN', 13.50, 21.90, 7, 20),
  ('20000000-0000-4000-8000-000000000002', 'produto-leite', 'LEI-1L-IN', 'Leite Integral 1 L', '10000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 'UN', 4.30, 6.49, 5, 50),
  ('20000000-0000-4000-8000-000000000003', 'produto-detergente', 'DET-500-N', 'Detergente Neutro 500 ml', '10000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', 'UN', 2.10, 3.99, 10, 30),
  ('20000000-0000-4000-8000-000000000004', 'produto-azeite', 'AZE-500-EV', 'Azeite Extra Virgem 500 ml', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'UN', 24.90, 38.90, 12, 18)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  supplier_id = EXCLUDED.supplier_id,
  cost_price = EXCLUDED.cost_price,
  sale_price = EXCLUDED.sale_price,
  lead_time_days = EXCLUDED.lead_time_days,
  minimum_stock = EXCLUDED.minimum_stock,
  updated_at = now();

INSERT INTO inventory_levels (
  product_id, warehouse_id, on_hand_quantity, reserved_quantity, measured_at
) VALUES
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 18, 4, now()),
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 50, 8, now()),
  ('20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 72, 4, now()),
  ('20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 34, 3, now())
ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
  on_hand_quantity = EXCLUDED.on_hand_quantity,
  reserved_quantity = EXCLUDED.reserved_quantity,
  measured_at = EXCLUDED.measured_at,
  updated_at = now();

INSERT INTO model_runs (
  id, task, algorithm, model_version, status, training_started_on,
  training_ended_on, parameters, metrics, started_at, finished_at
) VALUES
  ('40000000-0000-4000-8000-000000000001', 'forecast', 'seasonal-naive', 'baseline-sazonal-v1', 'succeeded', CURRENT_DATE - 60, CURRENT_DATE, '{"seasonality":7}', '{"wape":0.118}', now() - interval '5 minutes', now() - interval '2 minutes'),
  ('40000000-0000-4000-8000-000000000002', 'classification', 'abc-xyz', 'abc-xyz-v1', 'succeeded', CURRENT_DATE - 30, CURRENT_DATE, '{}', '{"products":4}', now() - interval '5 minutes', now() - interval '2 minutes')
ON CONFLICT (task, model_version) DO UPDATE SET
  status = EXCLUDED.status,
  parameters = EXCLUDED.parameters,
  metrics = EXCLUDED.metrics,
  finished_at = EXCLUDED.finished_at;

INSERT INTO product_analyses (
  id, product_id, model_run_id, abc_class, xyz_class, cluster_label, features, analyzed_at
) VALUES
  ('41000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'A', 'X', 'alta-rotacao', '{"coefficient_of_variation":0.18}', now()),
  ('41000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'A', 'X', 'alta-rotacao', '{"coefficient_of_variation":0.14}', now()),
  ('41000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'B', 'Y', 'demanda-regular', '{"coefficient_of_variation":0.42}', now()),
  ('41000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', 'A', 'Y', 'alto-valor', '{"coefficient_of_variation":0.37}', now())
ON CONFLICT (product_id, model_run_id) DO UPDATE SET
  abc_class = EXCLUDED.abc_class,
  xyz_class = EXCLUDED.xyz_class,
  cluster_label = EXCLUDED.cluster_label,
  features = EXCLUDED.features,
  analyzed_at = EXCLUDED.analyzed_at;

WITH parameters(product_id, base_units, unit_price) AS (
  VALUES
    ('20000000-0000-4000-8000-000000000001'::uuid, 7.2::numeric, 21.90::numeric),
    ('20000000-0000-4000-8000-000000000002'::uuid, 11.5::numeric, 6.49::numeric),
    ('20000000-0000-4000-8000-000000000003'::uuid, 3.7::numeric, 3.99::numeric),
    ('20000000-0000-4000-8000-000000000004'::uuid, 2.4::numeric, 38.90::numeric)
), generated AS (
  SELECT
    product_id,
    day::date AS demand_date,
    ROUND(base_units + ((EXTRACT(DOW FROM day)::integer + EXTRACT(DAY FROM day)::integer) % 4), 4) AS units_sold,
    unit_price
  FROM parameters
  CROSS JOIN generate_series(CURRENT_DATE - 29, CURRENT_DATE, interval '1 day') AS day
)
INSERT INTO daily_product_demand (
  product_id, demand_date, units_sold, gross_revenue, orders_count, was_stockout
)
SELECT
  product_id,
  demand_date,
  units_sold,
  ROUND(units_sold * unit_price, 2),
  CEIL(units_sold / 2)::integer,
  false
FROM generated
ON CONFLICT (product_id, demand_date) DO UPDATE SET
  units_sold = EXCLUDED.units_sold,
  gross_revenue = EXCLUDED.gross_revenue,
  orders_count = EXCLUDED.orders_count,
  was_stockout = EXCLUDED.was_stockout,
  calculated_at = now();

WITH parameters(product_id, base_units) AS (
  VALUES
    ('20000000-0000-4000-8000-000000000001'::uuid, 8.1::numeric),
    ('20000000-0000-4000-8000-000000000002'::uuid, 12.6::numeric),
    ('20000000-0000-4000-8000-000000000003'::uuid, 4.0::numeric),
    ('20000000-0000-4000-8000-000000000004'::uuid, 2.7::numeric)
), horizons(horizon_days) AS (VALUES (7), (30), (90)), generated AS (
  SELECT
    product_id,
    horizon_days,
    day::date AS target_date,
    ROUND(base_units + ((EXTRACT(DOW FROM day)::integer + horizon_days) % 3), 4) AS predicted
  FROM parameters
  CROSS JOIN horizons
  CROSS JOIN LATERAL generate_series(CURRENT_DATE + 1, CURRENT_DATE + horizons.horizon_days, interval '1 day') AS day
)
INSERT INTO demand_forecasts (
  product_id, model_run_id, generated_at, target_date, horizon_days,
  predicted_quantity, lower_bound, upper_bound
)
SELECT
  product_id,
  '40000000-0000-4000-8000-000000000001',
  now(),
  target_date,
  horizon_days,
  predicted,
  ROUND(predicted * 0.85, 4),
  ROUND(predicted * 1.15, 4)
FROM generated
ON CONFLICT (product_id, model_run_id, target_date, horizon_days) DO UPDATE SET
  generated_at = EXCLUDED.generated_at,
  predicted_quantity = EXCLUDED.predicted_quantity,
  lower_bound = EXCLUDED.lower_bound,
  upper_bound = EXCLUDED.upper_bound;

INSERT INTO sync_runs (
  id, source, status, cursor_started_at, cursor_ended_at, records_read,
  records_inserted, records_updated, started_at, finished_at
) VALUES (
  '50000000-0000-4000-8000-000000000001', 'seed-local', 'succeeded',
  now() - interval '1 day', now(), 128, 128, 0,
  now() - interval '4 minutes', now() - interval '3 minutes'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  records_read = EXCLUDED.records_read,
  records_inserted = EXCLUDED.records_inserted,
  records_updated = EXCLUDED.records_updated,
  finished_at = EXCLUDED.finished_at;
