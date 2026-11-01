ALTER TABLE admin_step_up_grants ADD COLUMN consumed_at TEXT;

CREATE TABLE IF NOT EXISTS admin_mfa_credentials (
  admin_user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  key_version INTEGER NOT NULL CHECK (key_version IN (1,2)),
  enabled_at TEXT,
  last_used_step INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_mfa_recovery_codes (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admin_user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_available
  ON admin_mfa_recovery_codes(admin_user_id, used_at);

CREATE TABLE IF NOT EXISTS admin_mfa_challenges (
  challenge_hash TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','enroll')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenge_expiry
  ON admin_mfa_challenges(expires_at, consumed_at);
