CREATE TABLE IF NOT EXISTS payment_refund_locks (
  payment_id TEXT PRIMARY KEY REFERENCES payments(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_refund_locks_created ON payment_refund_locks(created_at);
