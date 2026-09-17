-- Linhagem e carga analítica da fonte pública que substitui o ERP.
CREATE TABLE dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  version text NOT NULL,
  source_url text NOT NULL,
  doi text NOT NULL,
  license text NOT NULL,
  file_sha256 char(64) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'loading', 'ready', 'failed')),
  records_read bigint NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_accepted bigint NOT NULL DEFAULT 0 CHECK (records_accepted >= 0),
  records_rejected bigint NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  period_started_on date,
  period_ended_on date,
  quality_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version),
  UNIQUE (slug, file_sha256)
);

ALTER TABLE sync_runs ADD COLUMN dataset_version_id uuid REFERENCES dataset_versions(id);
ALTER TABLE sync_runs ALTER COLUMN source SET DEFAULT 'uci-online-retail-ii';
ALTER TABLE model_runs ADD COLUMN dataset_version_id uuid REFERENCES dataset_versions(id);
ALTER TABLE daily_product_demand ADD COLUMN dataset_version_id uuid REFERENCES dataset_versions(id);
ALTER TABLE products ADD COLUMN currency char(3) NOT NULL DEFAULT 'BRL'
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE products ADD CONSTRAINT products_source_check
  CHECK (source IN ('legacy', 'manual', 'csv', 'uci_online_retail'));
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_source_check;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_source_check
  CHECK (source IN ('legacy', 'manual', 'dataset'));
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_source_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_source_check
  CHECK (source IN ('legacy', 'manual', 'dataset'));

-- Fato desidentificado e particionado: preserva transações e cancelamentos
-- sem armazenar CustomerID. O modelo operacional recebe apenas vendas válidas.
CREATE TABLE retail_sales_facts (
  dataset_version_id uuid NOT NULL REFERENCES dataset_versions(id),
  invoice_date date NOT NULL,
  source_row_id text NOT NULL,
  source_sheet text NOT NULL,
  invoice_no text NOT NULL,
  stock_code text NOT NULL,
  description text,
  product_id uuid REFERENCES products(id),
  invoice_at timestamptz NOT NULL,
  quantity numeric(14,4) NOT NULL,
  unit_price numeric(14,4) NOT NULL,
  revenue numeric(16,4) NOT NULL,
  country text NOT NULL,
  is_cancellation boolean NOT NULL,
  is_duplicate boolean NOT NULL DEFAULT false,
  source_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset_version_id, invoice_date, source_row_id)
) PARTITION BY RANGE (invoice_date);

CREATE TABLE retail_sales_facts_2009 PARTITION OF retail_sales_facts
  FOR VALUES FROM ('2009-01-01') TO ('2010-01-01');
CREATE TABLE retail_sales_facts_2010 PARTITION OF retail_sales_facts
  FOR VALUES FROM ('2010-01-01') TO ('2011-01-01');
CREATE TABLE retail_sales_facts_2011 PARTITION OF retail_sales_facts
  FOR VALUES FROM ('2011-01-01') TO ('2012-01-01');
CREATE TABLE retail_sales_facts_default PARTITION OF retail_sales_facts DEFAULT;

CREATE INDEX idx_retail_facts_product_date ON retail_sales_facts (product_id, invoice_date);
CREATE INDEX idx_retail_facts_invoice_date ON retail_sales_facts (invoice_no, invoice_date);
CREATE INDEX idx_dataset_versions_status ON dataset_versions (status, created_at DESC);
CREATE INDEX idx_sync_runs_dataset ON sync_runs (dataset_version_id, created_at DESC);
CREATE INDEX idx_model_runs_dataset ON model_runs (dataset_version_id, created_at DESC);
