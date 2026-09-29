CREATE TABLE IF NOT EXISTS analytics_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('VisitorStarted','SessionStarted','ProductViewed','SearchPerformed','CartItemAdded','CheckoutStarted','PaymentStarted','PurchaseCompleted','RevenueRecorded')),
  event_version INTEGER NOT NULL CHECK (event_version = 1),
  occurred_at TEXT NOT NULL, received_at TEXT NOT NULL,
  session_id TEXT NOT NULL, visitor_id TEXT NOT NULL, request_id TEXT,
  source TEXT NOT NULL CHECK (source = 'web'), payload_json TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON analytics_events(event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_time ON analytics_events(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_expiry ON analytics_events(expires_at);
