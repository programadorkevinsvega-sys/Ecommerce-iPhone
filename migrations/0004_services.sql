CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  email TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('CARRIER_UNLOCK','DIAGNOSTIC','REPAIR','CONFIGURATION')),
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status, created_at ASC);
CREATE TABLE IF NOT EXISTS service_audit_events (
  id TEXT PRIMARY KEY,
  service_request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_audit_request ON service_audit_events(service_request_id, created_at DESC);
