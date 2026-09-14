PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repair_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  service_request_id TEXT UNIQUE REFERENCES service_requests(id) ON DELETE SET NULL,
  customer_id TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RECEIVED','DIAGNOSING','WAITING_APPROVAL','WAITING_PART','IN_REPAIR','QUALITY_CONTROL','READY','DELIVERED','CANCELLED')),
  problem_reported TEXT NOT NULL,
  diagnosis_summary TEXT,
  work_summary TEXT,
  assigned_technician_id TEXT,
  received_at TEXT NOT NULL,
  estimated_completion_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repair_device_sheets (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL UNIQUE REFERENCES repair_orders(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_last4 TEXT,
  imei_last4 TEXT,
  color TEXT,
  storage_gb INTEGER,
  battery_health INTEGER CHECK(battery_health IS NULL OR battery_health BETWEEN 0 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repair_device_condition_items (
  id TEXT PRIMARY KEY,
  device_sheet_id TEXT NOT NULL REFERENCES repair_device_sheets(id) ON DELETE CASCADE,
  component TEXT NOT NULL,
  condition TEXT NOT NULL CHECK(condition IN ('FUNCTIONAL','NOT_FUNCTIONAL','DAMAGED','NOT_TESTED','NOT_APPLICABLE')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_sheet_id, component)
);

CREATE TABLE IF NOT EXISTS repair_order_status_history (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer ON repair_orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_orders_technician ON repair_orders(assigned_technician_id, status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_repair_order_history_order ON repair_order_status_history(repair_order_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_repair_device_condition_sheet ON repair_device_condition_items(device_sheet_id);
