import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";

export function createNotificationTestDatabase(): D1SqliteTestDatabase {
  const database = new D1SqliteTestDatabase();
  database.exec(`
    CREATE TABLE notification_outbox (
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
      processed_at TEXT,
      event_version INTEGER NOT NULL DEFAULT 1,
      recipients_json TEXT NOT NULL DEFAULT '[]',
      terminal_at TEXT,
      queue_published_at TEXT,
      lease_expires_at TEXT
    );
    CREATE INDEX idx_notification_outbox_pending
      ON notification_outbox(status, available_at, created_at);
    CREATE INDEX idx_notification_outbox_reconciliation
      ON notification_outbox(status, available_at, queue_published_at, lease_expires_at);
  `);
  return database;
}
