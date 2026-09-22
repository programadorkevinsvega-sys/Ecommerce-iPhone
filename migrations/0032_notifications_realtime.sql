CREATE TABLE IF NOT EXISTS notification_inbox (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  recipient_type TEXT NOT NULL CHECK(recipient_type IN ('customer','technician','admin')),
  recipient_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  expires_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  UNIQUE(event_id, recipient_type, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_recipient_created
  ON notification_inbox(recipient_type, recipient_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_unread
  ON notification_inbox(recipient_type, recipient_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_channel_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('EMAIL','IN_APP')),
  recipient_type TEXT NOT NULL CHECK(recipient_type IN ('customer','technician','admin')),
  recipient_id TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL CHECK(status IN ('PENDING','CLAIMED','SENT','FAILED','TERMINAL')),
  attempts INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  last_error TEXT,
  next_retry_at TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  FOREIGN KEY(notification_id) REFERENCES notification_inbox(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_channel_unique
  ON notification_channel_deliveries(notification_id, channel, recipient_type, recipient_id);

CREATE INDEX IF NOT EXISTS idx_notification_channel_retry
  ON notification_channel_deliveries(status, next_retry_at, created_at);

CREATE TABLE IF NOT EXISTS notification_replay_audit (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  original_event_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('admin')),
  actor_id TEXT NOT NULL,
  replay_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_replay_notification
  ON notification_replay_audit(notification_id, created_at DESC);
