PRAGMA foreign_keys = ON;

ALTER TABLE customer_devices ADD COLUMN device_type TEXT NOT NULL DEFAULT 'PHONE';
ALTER TABLE customer_devices ADD COLUMN capacity TEXT;
ALTER TABLE customer_devices ADD COLUMN physical_condition TEXT;
ALTER TABLE customer_devices ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_devices_active
  ON customer_devices(customer_id, archived_at, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_device_events (
  id TEXT PRIMARY KEY,
  customer_device_id TEXT NOT NULL REFERENCES customer_devices(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK(event_type IN ('CREATED','UPDATED','ARCHIVED')),
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_device_events_device
  ON customer_device_events(customer_device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_device_events_customer
  ON customer_device_events(customer_id, created_at DESC);
