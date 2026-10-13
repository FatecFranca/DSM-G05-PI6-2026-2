-- Consultas somente leitura para prints no DBeaver. Não incluem credenciais.
SELECT current_database() AS banco, current_user AS usuario, inet_server_port() AS porta;

SELECT slug, version, is_simulated, currency, records_accepted,
       period_started_on, period_ended_on
FROM dataset_versions ORDER BY imported_at;

SELECT source, currency, count(*) AS produtos FROM products GROUP BY source,currency;

SELECT task, algorithm, model_version, status, training_started_on,
       training_ended_on, metrics
FROM model_runs ORDER BY finished_at DESC NULLS LAST;

SELECT schemaname, tablename FROM pg_tables
WHERE schemaname='public' ORDER BY tablename;

SELECT movement_type, count(*) AS total FROM stock_movements GROUP BY movement_type;
