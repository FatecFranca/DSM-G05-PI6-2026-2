ALTER TABLE warehouses ALTER COLUMN external_id DROP NOT NULL;
ALTER TABLE warehouses ADD COLUMN source text NOT NULL DEFAULT 'legacy'
  CHECK (source IN ('legacy', 'manual', 'bling'));
CREATE UNIQUE INDEX idx_warehouses_name_normalized_active
  ON warehouses (upper(btrim(name))) WHERE active;
