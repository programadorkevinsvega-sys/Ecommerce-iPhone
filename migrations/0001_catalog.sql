CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  description TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('NEW','USED','REFURBISHED')),
  price_in_cents INTEGER NOT NULL CHECK (price_in_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'COP',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  seo_title TEXT,
  seo_description TEXT,
  warranty_months INTEGER NOT NULL DEFAULT 12 CHECK (warranty_months >= 0),
  battery_health INTEGER CHECK (battery_health IS NULL OR (battery_health BETWEEN 0 AND 100)),
  storage_gb INTEGER,
  color TEXT,
  specs_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand, active);
CREATE INDEX IF NOT EXISTS idx_products_condition ON products(condition, active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_in_cents, active);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);
