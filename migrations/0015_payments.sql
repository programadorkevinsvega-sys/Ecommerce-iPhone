PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('WOMPI')),
  provider_reference TEXT NOT NULL UNIQUE,
  provider_transaction_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('CREATED','PENDING','PROCESSING','PAID','FAILED','CANCELLED','REFUNDED')),
  amount_in_cents INTEGER NOT NULL CHECK (amount_in_cents > 0),
  currency TEXT NOT NULL CHECK (length(currency)=3),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_status ON payments(provider, status);
CREATE INDEX IF NOT EXISTS idx_payments_updated ON payments(updated_at);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('WOMPI')),
  event_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_received ON payment_webhook_events(received_at);

CREATE TABLE IF NOT EXISTS payment_ledger (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL,
  amount_in_cents INTEGER NOT NULL CHECK (amount_in_cents >= 0),
  currency TEXT NOT NULL CHECK (length(currency)=3),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_id, entry_type, amount_in_cents)
);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_payment_created ON payment_ledger(payment_id, created_at DESC);
