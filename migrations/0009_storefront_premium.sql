CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  price_in_cents INTEGER NOT NULL CHECK (price_in_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, name)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id, active, sort_order);

ALTER TABLE cart_items ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);

CREATE TABLE IF NOT EXISTS product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  verified_purchase INTEGER NOT NULL DEFAULT 1 CHECK (verified_purchase IN (0,1)),
  admin_response TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, customer_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer ON product_reviews(customer_id, created_at DESC);

INSERT OR IGNORE INTO product_variants(id,product_id,name,options_json,price_in_cents,sort_order) VALUES
('var-iphone-17-256-black','prod-iphone-17-pro-max','256 GB · Titanio negro','{"storageGb":256,"color":"Titanio negro"}',649990000,0),
('var-iphone-17-512-black','prod-iphone-17-pro-max','512 GB · Titanio negro','{"storageGb":512,"color":"Titanio negro"}',719990000,1),
('var-s25-512-gray','prod-galaxy-s25-ultra','512 GB · Titanium Gray','{"storageGb":512,"color":"Titanium Gray"}',529990000,0),
('var-s25-1024-gray','prod-galaxy-s25-ultra','1 TB · Titanium Gray','{"storageGb":1024,"color":"Titanium Gray"}',599990000,1),
('var-iphone-16-256-natural','prod-iphone-16-pro','256 GB · Titanio natural','{"storageGb":256,"color":"Titanio natural"}',389990000,0);
