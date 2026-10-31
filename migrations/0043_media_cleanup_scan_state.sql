CREATE TABLE IF NOT EXISTS media_cleanup_scan_state (
  prefix TEXT PRIMARY KEY,
  cursor TEXT,
  next_scan_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO media_cleanup_scan_state (prefix)
VALUES
  ('product-images/'),
  ('category-images/'),
  ('service-images/'),
  ('home-carousel/');
