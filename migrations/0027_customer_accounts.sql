PRAGMA foreign_keys = ON;

ALTER TABLE customers ADD COLUMN whatsapp TEXT;
ALTER TABLE customers ADD COLUMN country_code TEXT NOT NULL DEFAULT 'CO';
ALTER TABLE customers ADD COLUMN password_hash TEXT;

CREATE TABLE IF NOT EXISTS customer_password_resets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_password_resets_active ON customer_password_resets(token_hash, expires_at, used_at);

CREATE TABLE IF NOT EXISTS customer_devices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_last4 TEXT,
  imei_last4 TEXT,
  color TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_devices_customer ON customer_devices(customer_id, created_at DESC);
