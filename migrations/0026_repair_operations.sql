PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repair_parts (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  quality TEXT NOT NULL CHECK(quality IN ('ORIGINAL','OEM','AFTERMARKET')),
  supplier TEXT,
  lot TEXT,
  unit_cost_in_cents INTEGER NOT NULL CHECK(unit_cost_in_cents >= 0),
  sale_price_in_cents INTEGER NOT NULL CHECK(sale_price_in_cents >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK(minimum_stock >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS repair_order_parts (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  part_id TEXT NOT NULL REFERENCES repair_parts(id),
  sku_snapshot TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  quality_snapshot TEXT NOT NULL,
  supplier_snapshot TEXT,
  lot_snapshot TEXT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_cost_in_cents INTEGER NOT NULL CHECK(unit_cost_in_cents >= 0),
  sale_price_in_cents INTEGER NOT NULL CHECK(sale_price_in_cents >= 0),
  status TEXT NOT NULL CHECK(status IN ('RESERVED','CONSUMED','RELEASED')),
  reserved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  released_at TEXT,
  UNIQUE(repair_order_id, part_id, status)
);
CREATE INDEX IF NOT EXISTS idx_repair_order_parts_order ON repair_order_parts(repair_order_id, status);

CREATE TABLE IF NOT EXISTS repair_order_labor (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK(minutes > 0),
  cost_in_cents INTEGER NOT NULL CHECK(cost_in_cents >= 0),
  price_in_cents INTEGER NOT NULL CHECK(price_in_cents >= 0),
  technician_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repair_quotes (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL UNIQUE REFERENCES repair_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('DRAFT','SENT','APPROVED','REJECTED')),
  parts_total_in_cents INTEGER NOT NULL DEFAULT 0 CHECK(parts_total_in_cents >= 0),
  labor_total_in_cents INTEGER NOT NULL DEFAULT 0 CHECK(labor_total_in_cents >= 0),
  total_in_cents INTEGER NOT NULL DEFAULT 0 CHECK(total_in_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'COP',
  notes TEXT,
  sent_at TEXT,
  customer_responded_at TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repair_qc_checks (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  check_name TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('PASS','FAIL','NOT_TESTED','NOT_APPLICABLE')),
  notes TEXT,
  checked_by TEXT,
  checked_at TEXT,
  UNIQUE(repair_order_id, check_name)
);
CREATE INDEX IF NOT EXISTS idx_repair_qc_order ON repair_qc_checks(repair_order_id);

CREATE TABLE IF NOT EXISTS repair_warranties (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL UNIQUE REFERENCES repair_orders(id) ON DELETE CASCADE,
  warranty_number TEXT NOT NULL UNIQUE,
  coverage TEXT NOT NULL,
  months INTEGER NOT NULL CHECK(months > 0 AND months <= 120),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','EXPIRED','VOID')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
