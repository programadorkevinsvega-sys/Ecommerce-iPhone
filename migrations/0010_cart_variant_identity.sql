PRAGMA foreign_keys = OFF;

CREATE TABLE cart_items_v2 (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_in_cents INTEGER NOT NULL CHECK (unit_price_in_cents >= 0),
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cart_items_v2(id,cart_id,product_id,quantity,unit_price_in_cents,variant_id,created_at,updated_at)
SELECT lower(hex(randomblob(16))),cart_id,product_id,quantity,unit_price_in_cents,variant_id,created_at,updated_at
FROM cart_items;

DROP TABLE cart_items;
ALTER TABLE cart_items_v2 RENAME TO cart_items;

CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_identity ON cart_items(cart_id,product_id,COALESCE(variant_id,''));

PRAGMA foreign_keys = ON;
