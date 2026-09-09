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

INSERT OR IGNORE INTO products (id,name,slug,brand,model,description,condition,price_in_cents,currency,stock,active,seo_title,seo_description,warranty_months,battery_health,storage_gb,color,specs_json)
VALUES
('prod-iphone-17-pro-max','iPhone 17 Pro Max','iphone-17-pro-max','Apple','iPhone 17 Pro Max','Smartphone premium con cámara Pro, gran autonomía y pantalla de alta gama.','NEW',649990000,'COP',8,1,'iPhone 17 Pro Max nuevo | Ecommerce iPhone','Compra iPhone 17 Pro Max nuevo con garantía, inventario y atención especializada.',12,NULL,256,'Titanio negro','{"Pantalla":"6.9 pulgadas","Chip":"A19 Pro","Cámara":"Pro 48 MP","Conectividad":"5G"}'),
('prod-galaxy-s25-ultra','Samsung Galaxy S25 Ultra','galaxy-s25-ultra','Samsung','Galaxy S25 Ultra','Flagship Samsung con pantalla premium, cámara avanzada y alto rendimiento.','NEW',529990000,'COP',6,1,'Samsung Galaxy S25 Ultra | Ecommerce iPhone','Galaxy S25 Ultra nuevo con garantía y soporte especializado.',12,NULL,512,'Titanium Gray','{"Pantalla":"6.9 pulgadas","RAM":"12 GB","Cámara":"200 MP","Conectividad":"5G"}'),
('prod-iphone-16-pro','iPhone 16 Pro','iphone-16-pro','Apple','iPhone 16 Pro','iPhone Pro de generación anterior en excelente estado, ideal para alto rendimiento.','REFURBISHED',389990000,'COP',4,1,'iPhone 16 Pro reacondicionado | Ecommerce iPhone','iPhone 16 Pro reacondicionado con batería verificada y garantía.',6,98,256,'Titanio natural','{"Pantalla":"6.3 pulgadas","Chip":"A18 Pro","Cámara":"Pro 48 MP","Conectividad":"5G"}');

INSERT OR IGNORE INTO product_images (id,product_id,url,alt_text,sort_order) VALUES
('img-iphone-17-1','prod-iphone-17-pro-max','/products/iphone-17-pro-max.webp','iPhone 17 Pro Max',0),
('img-s25-1','prod-galaxy-s25-ultra','/products/galaxy-s25-ultra.webp','Samsung Galaxy S25 Ultra',0),
('img-iphone-16-1','prod-iphone-16-pro','/products/iphone-16-pro.webp','iPhone 16 Pro',0);
