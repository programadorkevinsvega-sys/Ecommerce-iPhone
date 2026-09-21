PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_user_permissions (
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted INTEGER NOT NULL CHECK(granted IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_permissions_permission
  ON admin_user_permissions(permission, granted);

CREATE INDEX IF NOT EXISTS idx_admin_user_permissions_user
  ON admin_user_permissions(admin_user_id, granted);
