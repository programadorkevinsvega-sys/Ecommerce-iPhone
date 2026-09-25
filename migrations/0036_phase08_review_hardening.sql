PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS review_moderation_events (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  from_status TEXT NOT NULL CHECK (from_status IN ('PENDING','APPROVED','REJECTED')),
  to_status TEXT NOT NULL CHECK (to_status IN ('PENDING','APPROVED','REJECTED')),
  response TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (from_status <> to_status)
);
CREATE INDEX IF NOT EXISTS idx_review_moderation_events_review ON review_moderation_events(review_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_reports (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEWED','DISMISSED','ACTIONED')),
  resolved_by TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id, customer_id),
  CHECK ((status='OPEN' AND resolved_by IS NULL AND resolved_at IS NULL) OR (status<>'OPEN' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_reports_customer ON review_reports(customer_id, created_at DESC);
