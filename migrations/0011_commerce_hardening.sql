PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_active ON customer_sessions(token_hash, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS checkout_guards (
  id INTEGER PRIMARY KEY CHECK (id = 1)
);
INSERT OR IGNORE INTO checkout_guards(id) VALUES (1);
