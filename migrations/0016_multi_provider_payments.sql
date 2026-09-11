PRAGMA foreign_keys = OFF;

CREATE TABLE payments_v2 (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('WOMPI','STRIPE','MERCADOPAGO','PAYPAL','BINANCE_PAY')),
  provider_reference TEXT NOT NULL UNIQUE,
  provider_transaction_id TEXT UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('CREATED','PENDING','PROCESSING','PAID','FAILED','CANCELLED','REFUNDED')),
  amount_in_cents INTEGER NOT NULL CHECK (amount_in_cents > 0),
  currency TEXT NOT NULL CHECK (length(currency)=3),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, idempotency_key)
);

INSERT INTO payments_v2(id,order_id,customer_id,provider,provider_reference,provider_transaction_id,checkout_url,status,amount_in_cents,currency,idempotency_key,created_at,updated_at)
SELECT id,order_id,customer_id,provider,provider_reference,provider_transaction_id,NULL,status,amount_in_cents,currency,idempotency_key,created_at,updated_at FROM payments;

DROP TABLE payments;
ALTER TABLE payments_v2 RENAME TO payments;

CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_status ON payments(provider, status);
CREATE INDEX IF NOT EXISTS idx_payments_updated ON payments(updated_at);

CREATE TABLE payment_webhook_events_v2 (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('WOMPI','STRIPE','MERCADOPAGO','PAYPAL','BINANCE_PAY')),
  event_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, event_id)
);
INSERT INTO payment_webhook_events_v2(id,provider,event_id,payload_json,received_at)
SELECT id,provider,event_id,payload_json,received_at FROM payment_webhook_events;
DROP TABLE payment_webhook_events;
ALTER TABLE payment_webhook_events_v2 RENAME TO payment_webhook_events;
CREATE INDEX IF NOT EXISTS idx_payment_webhook_received ON payment_webhook_events(received_at);

PRAGMA foreign_keys = ON;
