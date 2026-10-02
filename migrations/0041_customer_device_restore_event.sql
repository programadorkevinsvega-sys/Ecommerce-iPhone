PRAGMA foreign_keys = ON;

CREATE TABLE customer_device_events_v2 (
  id TEXT PRIMARY KEY,
  customer_device_id TEXT NOT NULL REFERENCES customer_devices(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK(event_type IN ('CREATED','UPDATED','ARCHIVED','RESTORED')),
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO customer_device_events_v2(id, customer_device_id, customer_id, event_type, metadata_json, created_at)
SELECT id, customer_device_id, customer_id, event_type, metadata_json, created_at
FROM customer_device_events;

DROP TABLE customer_device_events;
ALTER TABLE customer_device_events_v2 RENAME TO customer_device_events;

CREATE INDEX IF NOT EXISTS idx_customer_device_events_device
  ON customer_device_events(customer_device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_device_events_customer
  ON customer_device_events(customer_id, created_at DESC);
