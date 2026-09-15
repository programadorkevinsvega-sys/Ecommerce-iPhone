PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customer_security_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'REGISTERED',
    'LOGIN_SUCCEEDED',
    'LOGIN_FAILED',
    'LOGOUT',
    'PROFILE_UPDATED',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED'
  )),
  source_ip TEXT,
  user_agent TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_security_events_customer
  ON customer_security_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_security_events_type
  ON customer_security_events(event_type, created_at DESC);
