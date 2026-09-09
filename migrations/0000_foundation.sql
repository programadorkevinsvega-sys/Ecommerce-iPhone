-- Foundation migration.
-- Business tables are introduced by their owning modules in later phases.
-- This migration intentionally contains no domain tables.

CREATE TABLE IF NOT EXISTS _schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO _schema_version (version) VALUES (0);
