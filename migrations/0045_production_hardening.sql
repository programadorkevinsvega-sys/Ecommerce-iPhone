ALTER TABLE notification_outbox ADD COLUMN request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_request_id
  ON notification_outbox(request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_step_up_grants (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK(scope IN ('payments:refund','payments:void','admins:manage','settings:write')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_step_up_lookup
  ON admin_step_up_grants(admin_user_id, session_token_hash, scope, expires_at);
