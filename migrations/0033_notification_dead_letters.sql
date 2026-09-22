CREATE TABLE IF NOT EXISTS notification_dead_letters (
  id TEXT PRIMARY KEY,
  queue_name TEXT NOT NULL,
  message_id TEXT,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REPLAYED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_replayed_at TEXT,
  replayed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_dlq_status
  ON notification_dead_letters(status, first_seen_at DESC);
