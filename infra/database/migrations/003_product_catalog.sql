-- Identidade interna independente do ERP. IDs antigos são preservados.
ALTER TABLE products ALTER COLUMN external_id DROP NOT NULL;
ALTER TABLE products ADD COLUMN source text NOT NULL DEFAULT 'legacy'
  CHECK (source IN ('legacy', 'manual', 'csv', 'bling'));
ALTER TABLE products ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE UNIQUE INDEX idx_products_sku_normalized ON products (upper(btrim(sku)));

-- Vínculos futuros devem ser resolvidos explicitamente; nunca unir por SKU silenciosamente.
CREATE TABLE product_external_links (
  provider text NOT NULL,
  account_id text NOT NULL,
  external_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id),
  source_updated_at timestamptz,
  PRIMARY KEY (provider, account_id, external_id),
  UNIQUE (product_id, provider, account_id)
);
