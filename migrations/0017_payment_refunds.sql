CREATE TABLE IF NOT EXISTS payment_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  provider_refund_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED')),
  amount_in_cents INTEGER NOT NULL CHECK (amount_in_cents > 0),
  currency TEXT NOT NULL CHECK (length(currency)=3),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_id, idempotency_key),
  UNIQUE(payment_id, provider_refund_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON payment_refunds(payment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_provider ON payment_refunds(provider_refund_id);
