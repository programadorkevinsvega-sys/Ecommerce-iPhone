ALTER TABLE repair_orders ADD COLUMN public_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_orders_public_token ON repair_orders(public_token) WHERE public_token IS NOT NULL;
CREATE TABLE IF NOT EXISTS repair_order_media (id TEXT PRIMARY KEY, repair_order_id TEXT NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE, stage TEXT NOT NULL CHECK(stage IN ('RECEPTION','DIAGNOSIS','REPAIR','QUALITY_CONTROL')), url TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, uploaded_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_repair_media_order ON repair_order_media(repair_order_id, stage, created_at DESC);
