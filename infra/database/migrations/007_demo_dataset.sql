ALTER TABLE dataset_versions ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE dataset_versions ADD COLUMN currency char(3) NOT NULL DEFAULT 'GBP';
ALTER TABLE dataset_versions ADD COLUMN display_name text NOT NULL DEFAULT 'UCI Online Retail II';
ALTER TABLE products DROP CONSTRAINT products_source_check;
ALTER TABLE products ADD CONSTRAINT products_source_check
  CHECK (source IN ('legacy','manual','csv','uci_online_retail','simulated'));

-- Original records remain accessible in the base tables. Operational lists use
-- the active dataset plus manually managed products, without mixing currencies.
CREATE VIEW operational_products AS
SELECT p.* FROM products p WHERE
  p.source NOT IN ('uci_online_retail','simulated') OR
  (p.source='simulated' AND COALESCE((SELECT is_simulated FROM dataset_versions
    WHERE status='ready' ORDER BY imported_at DESC NULLS LAST LIMIT 1),false)) OR
  (p.source='uci_online_retail' AND NOT COALESCE((SELECT is_simulated FROM dataset_versions
    WHERE status='ready' ORDER BY imported_at DESC NULLS LAST LIMIT 1),false));

CREATE VIEW operational_warehouses AS
SELECT w.* FROM warehouses w WHERE w.source <> 'dataset' OR
  (w.external_id='demo-brl-warehouse' AND COALESCE((SELECT is_simulated FROM dataset_versions
    WHERE status='ready' ORDER BY imported_at DESC NULLS LAST LIMIT 1),false)) OR
  (w.external_id <> 'demo-brl-warehouse' AND NOT COALESCE((SELECT is_simulated FROM dataset_versions
    WHERE status='ready' ORDER BY imported_at DESC NULLS LAST LIMIT 1),false));

CREATE INDEX idx_demand_dataset_product_date ON daily_product_demand(dataset_version_id,product_id,demand_date);
