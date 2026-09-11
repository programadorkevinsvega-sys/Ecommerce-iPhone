PRAGMA foreign_keys = ON;

ALTER TABLE order_items ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);
