PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id),
  delta INTEGER NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product ON inventory_adjustments(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_admin ON inventory_adjustments(admin_user_id, created_at DESC);
