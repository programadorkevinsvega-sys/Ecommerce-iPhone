ALTER TABLE categories ADD COLUMN image_url TEXT;
ALTER TABLE service_types ADD COLUMN image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_active_image ON categories(active, image_url);
CREATE INDEX IF NOT EXISTS idx_service_types_enabled_image ON service_types(enabled, image_url);
