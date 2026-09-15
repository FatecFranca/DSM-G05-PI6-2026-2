-- Movimentações manuais continuam independentes do identificador do ERP.
ALTER TABLE stock_movements ADD COLUMN source text NOT NULL DEFAULT 'legacy'
  CHECK (source IN ('legacy', 'manual', 'bling'));
ALTER TABLE stock_movements ADD COLUMN actor_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN reason text;
ALTER TABLE stock_movements ADD COLUMN resulting_on_hand numeric(14, 4);
ALTER TABLE stock_movements ADD COLUMN transfer_id uuid;

-- NOT VALID preserva uma eventual carga legada inconsistente, mas protege toda nova escrita.
ALTER TABLE inventory_levels ADD CONSTRAINT inventory_on_hand_nonnegative
  CHECK (on_hand_quantity >= 0) NOT VALID;
ALTER TABLE inventory_levels ADD CONSTRAINT inventory_reserved_valid
  CHECK (reserved_quantity >= 0 AND reserved_quantity <= on_hand_quantity) NOT VALID;

INSERT INTO warehouses (external_id, name)
VALUES ('deposito-principal', 'Depósito principal')
ON CONFLICT (external_id) DO NOTHING;

CREATE INDEX idx_stock_movements_warehouse_occurred
  ON stock_movements (warehouse_id, occurred_at DESC, id DESC);
CREATE INDEX idx_stock_movements_transfer_id
  ON stock_movements (transfer_id) WHERE transfer_id IS NOT NULL;
