CREATE INDEX IF NOT EXISTS idx_payment_ledger_revenue_time
  ON payment_ledger(entry_type, created_at, id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_conversion_time
  ON analytics_events(event_type, source, occurred_at);
