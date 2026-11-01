CREATE TABLE IF NOT EXISTS web_vitals_measurements (
  metric_id TEXT PRIMARY KEY,
  metric TEXT NOT NULL CHECK (metric IN ('LCP','INP','CLS')),
  value REAL NOT NULL CHECK (value >= 0),
  rating TEXT NOT NULL CHECK (rating IN ('good','needs-improvement','poor')),
  route TEXT NOT NULL CHECK (route IN ('/','/catalog','/iphone/:slug','/cart','/checkout','/admin/login','/other')),
  environment TEXT NOT NULL,
  release TEXT,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile','tablet','desktop')),
  measured_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_web_vitals_period ON web_vitals_measurements(measured_at, metric, route, environment);
CREATE INDEX IF NOT EXISTS idx_web_vitals_expiry ON web_vitals_measurements(expires_at);
