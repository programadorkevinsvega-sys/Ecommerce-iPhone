CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','QUEUED','PROCESSED','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON notification_outbox(status, available_at, created_at);
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('EMAIL')),
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('SENT','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(outbox_id) REFERENCES notification_outbox(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_unique ON notification_deliveries(outbox_id, channel, recipient, template);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient ON notification_deliveries(recipient, created_at DESC);
