ALTER TABLE service_requests ADD COLUMN phone TEXT;
ALTER TABLE service_requests ADD COLUMN whatsapp TEXT;
ALTER TABLE service_requests ADD COLUMN country_code TEXT;

CREATE INDEX IF NOT EXISTS idx_service_requests_country ON service_requests(country_code, created_at DESC);
