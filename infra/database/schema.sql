CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE order_status AS ENUM ('open', 'approved', 'completed', 'cancelled', 'returned');
CREATE TYPE sync_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'partial');
CREATE TYPE model_task AS ENUM ('forecast', 'clustering', 'classification');
CREATE TYPE run_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'rejected');

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id),
  supplier_id uuid REFERENCES suppliers(id),
  active boolean NOT NULL DEFAULT true,
  unit text NOT NULL DEFAULT 'UN',
  cost_price numeric(14, 4) CHECK (cost_price IS NULL OR cost_price >= 0),
  sale_price numeric(14, 4) CHECK (sale_price IS NULL OR sale_price >= 0),
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  minimum_stock numeric(14, 4) CHECK (minimum_stock IS NULL OR minimum_stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_levels (
  product_id uuid NOT NULL REFERENCES products(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  on_hand_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  reserved_quantity numeric(14, 4) NOT NULL DEFAULT 0,
  available_quantity numeric(14, 4) GENERATED ALWAYS AS (on_hand_quantity - reserved_quantity) STORED,
  measured_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, warehouse_id)
);

CREATE TABLE sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  order_number text,
  sold_at timestamptz NOT NULL,
  status order_status NOT NULL,
  channel text,
  total_amount numeric(14, 2) NOT NULL CHECK (total_amount >= 0),
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  line_number integer NOT NULL CHECK (line_number > 0),
  quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14, 4) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric(14, 2) NOT NULL CHECK (total_amount >= 0),
  UNIQUE (order_id, line_number)
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  product_id uuid NOT NULL REFERENCES products(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  movement_type text NOT NULL,
  quantity_delta numeric(14, 4) NOT NULL CHECK (quantity_delta <> 0),
  occurred_at timestamptz NOT NULL,
  reference_type text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_product_demand (
  product_id uuid NOT NULL REFERENCES products(id),
  demand_date date NOT NULL,
  units_sold numeric(14, 4) NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  gross_revenue numeric(14, 2) NOT NULL DEFAULT 0 CHECK (gross_revenue >= 0),
  orders_count integer NOT NULL DEFAULT 0 CHECK (orders_count >= 0),
  was_stockout boolean,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, demand_date)
);

CREATE TABLE model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task model_task NOT NULL,
  algorithm text NOT NULL,
  model_version text NOT NULL,
  status run_status NOT NULL DEFAULT 'pending',
  training_started_on date,
  training_ended_on date,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_uri text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task, model_version)
);

CREATE TABLE demand_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  model_run_id uuid NOT NULL REFERENCES model_runs(id),
  generated_at timestamptz NOT NULL,
  target_date date NOT NULL,
  horizon_days integer NOT NULL CHECK (horizon_days IN (7, 30, 90)),
  predicted_quantity numeric(14, 4) NOT NULL CHECK (predicted_quantity >= 0),
  lower_bound numeric(14, 4) CHECK (lower_bound IS NULL OR lower_bound >= 0),
  upper_bound numeric(14, 4) CHECK (upper_bound IS NULL OR upper_bound >= 0),
  UNIQUE (product_id, model_run_id, target_date, horizon_days),
  CHECK (upper_bound IS NULL OR lower_bound IS NULL OR upper_bound >= lower_bound)
);

CREATE TABLE product_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  model_run_id uuid NOT NULL REFERENCES model_runs(id),
  abc_class char(1) CHECK (abc_class IN ('A', 'B', 'C')),
  xyz_class char(1) CHECK (xyz_class IN ('X', 'Y', 'Z')),
  cluster_label text,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  analyzed_at timestamptz NOT NULL,
  UNIQUE (product_id, model_run_id)
);

CREATE TABLE sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'bling',
  status sync_status NOT NULL DEFAULT 'pending',
  cursor_started_at timestamptz,
  cursor_ended_at timestamptz,
  records_read integer NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_inserted integer NOT NULL DEFAULT 0 CHECK (records_inserted >= 0),
  records_updated integer NOT NULL DEFAULT 0 CHECK (records_updated >= 0),
  records_rejected integer NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE data_quality_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  passed_count integer NOT NULL DEFAULT 0 CHECK (passed_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  sample jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sync_run_id, rule_code)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  correlation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text
);

CREATE TABLE processed_messages (
  consumer_name text NOT NULL,
  message_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, message_id)
);

CREATE INDEX idx_products_category_active ON products (category_id, active);
CREATE INDEX idx_sales_orders_sold_at_status ON sales_orders (sold_at, status);
CREATE INDEX idx_sales_order_items_product ON sales_order_items (product_id, order_id);
CREATE INDEX idx_stock_movements_product_occurred ON stock_movements (product_id, occurred_at DESC);
CREATE INDEX idx_daily_demand_date ON daily_product_demand (demand_date, product_id);
CREATE INDEX idx_forecasts_product_target ON demand_forecasts (product_id, target_date);
CREATE INDEX idx_sync_runs_created_at ON sync_runs (created_at DESC);
CREATE INDEX idx_outbox_unpublished ON outbox_events (occurred_at)
  WHERE published_at IS NULL;
CREATE INDEX idx_processed_messages_time ON processed_messages (processed_at DESC);
CREATE INDEX idx_products_supplier_id ON products (supplier_id);
CREATE INDEX idx_inventory_levels_warehouse_id ON inventory_levels (warehouse_id);
CREATE INDEX idx_stock_movements_warehouse_id ON stock_movements (warehouse_id);
CREATE INDEX idx_demand_forecasts_model_run_id ON demand_forecasts (model_run_id);
CREATE INDEX idx_product_analyses_model_run_id ON product_analyses (model_run_id);
