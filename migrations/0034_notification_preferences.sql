ALTER TABLE notification_outbox ADD COLUMN terminal_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_retryable
  ON notification_outbox(status, terminal_at, available_at, created_at);

CREATE TABLE IF NOT EXISTS notification_preferences (
  recipient_type TEXT NOT NULL CHECK(recipient_type IN ('customer','technician','admin')),
  recipient_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('EMAIL','IN_APP')),
  event_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(recipient_type, recipient_id, channel, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_recipient
  ON notification_preferences(recipient_type, recipient_id, channel);
