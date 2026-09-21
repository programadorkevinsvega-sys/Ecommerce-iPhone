PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS technician_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS technician_sessions (
  id TEXT PRIMARY KEY,
  technician_user_id TEXT NOT NULL REFERENCES technician_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS technician_audit_events (
  id TEXT PRIMARY KEY,
  technician_user_id TEXT REFERENCES technician_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_technician_users_active ON technician_users(active, first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_technician_sessions_user ON technician_sessions(technician_user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_technician_sessions_active ON technician_sessions(token_hash, expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS idx_technician_audit_created ON technician_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_technician_audit_resource ON technician_audit_events(resource_type, resource_id, created_at DESC);

INSERT OR IGNORE INTO technician_users (id,email,password_hash,first_name,last_name,active,failed_login_count,locked_until,last_login_at,created_at,updated_at)
SELECT id,email,password_hash,first_name,last_name,active,failed_login_count,locked_until,last_login_at,created_at,updated_at
FROM admin_users
WHERE role='TECHNICIAN';

UPDATE admin_users
SET active=0, updated_at=CURRENT_TIMESTAMP
WHERE role='TECHNICIAN';

ALTER TABLE repair_orders ADD COLUMN customer_device_id TEXT REFERENCES customer_devices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer_device ON repair_orders(customer_device_id);
