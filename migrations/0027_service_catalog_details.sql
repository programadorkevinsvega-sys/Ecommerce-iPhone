ALTER TABLE service_types ADD COLUMN price_from_in_cents INTEGER CHECK(price_from_in_cents IS NULL OR price_from_in_cents >= 0);
ALTER TABLE service_types ADD COLUMN fixed_price_in_cents INTEGER CHECK(fixed_price_in_cents IS NULL OR fixed_price_in_cents >= 0);
ALTER TABLE service_types ADD COLUMN estimated_minutes INTEGER CHECK(estimated_minutes IS NULL OR estimated_minutes > 0);
ALTER TABLE service_types ADD COLUMN warranty_days INTEGER CHECK(warranty_days IS NULL OR warranty_days >= 0);
ALTER TABLE service_types ADD COLUMN requires_diagnosis INTEGER NOT NULL DEFAULT 0 CHECK(requires_diagnosis IN (0,1));
ALTER TABLE service_types ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 0 CHECK(requires_approval IN (0,1));

CREATE TABLE IF NOT EXISTS service_type_compatibility (
  id TEXT PRIMARY KEY,
  service_type_code TEXT NOT NULL REFERENCES service_types(code) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(service_type_code, brand, model)
);

CREATE TABLE IF NOT EXISTS service_type_requirements (
  id TEXT PRIMARY KEY,
  service_type_code TEXT NOT NULL REFERENCES service_types(code) ON DELETE CASCADE,
  description TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_type_compatibility_code ON service_type_compatibility(service_type_code, brand, model);
CREATE INDEX IF NOT EXISTS idx_service_type_requirements_code ON service_type_requirements(service_type_code, sort_order);
