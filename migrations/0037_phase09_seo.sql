CREATE TABLE IF NOT EXISTS seo_redirects (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL UNIQUE,
  target_url TEXT,
  status_code INTEGER NOT NULL CHECK (status_code IN (301, 410)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by_admin_id TEXT NOT NULL,
  updated_by_admin_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (status_code = 301 AND target_url IS NOT NULL AND length(trim(target_url)) > 0)
    OR (status_code = 410 AND target_url IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_seo_redirects_active_source
  ON seo_redirects(active, source_path);

CREATE TABLE IF NOT EXISTS seo_route_overrides (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  indexable INTEGER NOT NULL DEFAULT 1 CHECK (indexable IN (0, 1)),
  og_image_url TEXT,
  created_by_admin_id TEXT NOT NULL,
  updated_by_admin_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_route_overrides_path
  ON seo_route_overrides(path);
