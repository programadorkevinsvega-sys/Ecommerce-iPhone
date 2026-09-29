PRAGMA foreign_keys = OFF;

CREATE TABLE analytics_events_v2 (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'VisitorStarted',
      'SessionStarted',
      'ProductViewed',
      'SearchPerformed',
      'SearchResultClicked',
      'CategoryNavigated',
      'FilterApplied',
      'PaginationChanged',
      'ProductVariantSelected',
      'RelatedProductClicked',
      'CartItemAdded',
      'CartItemRemoved',
      'CartAbandoned',
      'CheckoutStarted',
      'ShippingMethodSelected',
      'PaymentStarted',
      'PurchaseCompleted',
      'RevenueRecorded'
    )
  ),
  event_version INTEGER NOT NULL CHECK (event_version = 1),
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  request_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('web', 'server')),
  payload_json TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

INSERT INTO analytics_events_v2 (
  event_id,
  event_type,
  event_version,
  occurred_at,
  received_at,
  session_id,
  visitor_id,
  request_id,
  source,
  payload_json,
  expires_at
)
SELECT
  event_id,
  event_type,
  event_version,
  occurred_at,
  received_at,
  session_id,
  visitor_id,
  request_id,
  source,
  payload_json,
  expires_at
FROM analytics_events;

DROP TABLE analytics_events;
ALTER TABLE analytics_events_v2 RENAME TO analytics_events;

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time
  ON analytics_events(event_type, occurred_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_time
  ON analytics_events(session_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_expiry
  ON analytics_events(expires_at);

PRAGMA foreign_keys = ON;
