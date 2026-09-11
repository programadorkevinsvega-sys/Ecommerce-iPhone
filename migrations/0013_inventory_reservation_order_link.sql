PRAGMA foreign_keys = ON;

ALTER TABLE inventory_reservations ADD COLUMN order_id TEXT REFERENCES orders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order ON inventory_reservations(order_id, released_at);
