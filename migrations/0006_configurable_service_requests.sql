-- Remove the legacy hard-coded service type CHECK constraint from 0004.
-- Service types are now tenant/buyer-configurable and validated against service_types.
CREATE TABLE service_requests_v2 (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  device_serial_last4 TEXT,
  imei_last4 TEXT,
  carrier TEXT,
  problem_description TEXT NOT NULL,
  customer_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','QUOTED','PAYMENT_PENDING','PAID','PROCESSING','WAITING_CUSTOMER','COMPLETED','REJECTED','REFUNDED')),
  quote_in_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'COP',
  payment_id TEXT,
  assigned_technician_id TEXT,
  resolution_notes TEXT,
  service_type_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO service_requests_v2 (
  id, customer_id, email, type, device_brand, device_model,
  device_serial_last4, imei_last4, carrier, problem_description,
  customer_notes, status, quote_in_cents, currency, payment_id,
  assigned_technician_id, resolution_notes, service_type_code,
  created_at, updated_at
)
SELECT
  id, customer_id, email, type, device_brand, device_model,
  device_serial_last4, imei_last4, carrier, problem_description,
  customer_notes, status, quote_in_cents, currency, payment_id,
  assigned_technician_id, resolution_notes, service_type_code,
  created_at, updated_at
FROM service_requests;

DROP TABLE service_requests;
ALTER TABLE service_requests_v2 RENAME TO service_requests;

CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_service_requests_type ON service_requests(service_type_code, created_at DESC);
