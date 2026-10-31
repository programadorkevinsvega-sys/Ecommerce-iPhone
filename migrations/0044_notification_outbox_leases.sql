ALTER TABLE notification_outbox ADD COLUMN queue_published_at TEXT;
ALTER TABLE notification_outbox ADD COLUMN lease_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_reconciliation
  ON notification_outbox(status, available_at, queue_published_at, lease_expires_at);

-- Preserve recoverability for rows created by the previous shared available_at lease.
UPDATE notification_outbox
SET
  queue_published_at = CASE
    WHEN available_at > datetime('now', '+600 seconds') THEN CURRENT_TIMESTAMP
    ELSE datetime(available_at, '-600 seconds')
  END,
  lease_expires_at = CASE
    WHEN available_at > datetime('now', '+600 seconds') THEN available_at
    ELSE NULL
  END
WHERE status = 'QUEUED';
