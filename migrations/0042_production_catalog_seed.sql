-- Production catalog seed: 10 real smartphone models researched against current Colombia market listings.
-- Price snapshot: 2026-10-02. Prices are reference retail/listing prices in COP, not supplier quotes.
-- Images use real Wikimedia Commons files; each URL is a public file redirect and the file license/source
-- should be respected if the storefront displays the image publicly.

PRAGMA foreign_keys = ON;

INSERT INTO categories (id,name,slug,active)
VALUES
  ('cat-smartphones','Smartphones','smartphones',1),
  ('cat-apple','Apple iPhone','apple-iphone',1),
  ('cat-samsung','Samsung Galaxy','samsung-galaxy',1),
  ('cat-android-premium','Android premium','android-premium',1),
  ('cat-android-alta','Android gama alta','android-gama-alta',1),
  ('cat-5g','Smartphones 5G','smartphones-5g',1)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  slug=excluded.slug,
  active=excluded.active,
  updated_at=CURRENT_TIMESTAMP;

-- Rebuild the legacy iPhone 17 Pro Max row instead of creating a duplicate slug.
INSERT INTO products (
  id,name,slug,brand,model,description,condition,price_in_cents,currency,stock,active,
  seo_title,seo_description,warranty_months,battery_health,storage_gb,color,specs_json
) VALUES (
  'prod-iphone-17-pro-max',
  'Apple iPhone 17 Pro Max 256 GB',
  'iphone-17-pro-max',
  'Apple',
  'iPhone 17 Pro Max',
  'iPhone 17 Pro Max de 256 GB con chip A19 Pro, pantalla Super Retina XDR de 6,9 pulgadas, ProMotion de hasta 120 Hz y sistema de cámaras Fusion de 48 MP.',
  'NEW',464900000,'COP',0,1,
  'iPhone 17 Pro Max 256 GB | Comprar en Colombia',
  'Compra el Apple iPhone 17 Pro Max de 256 GB. Chip A19 Pro, pantalla Super Retina XDR de 6,9 pulgadas, cámaras Fusion de 48 MP y 5G.',
  12,NULL,256,'Azul profundo',
  '{"ramGb":"12","display":"6.9-inch Super Retina XDR OLED","refreshRateHz":"120","processor":"Apple A19 Pro","rearCamera":"48 MP Fusion triple camera","frontCamera":"18 MP Center Stage","battery":"All-day battery with extended Pro Max capacity","charging":"USB-C fast charging","network":"5G","os":"iOS 26","waterResistance":"IP68","sim":"eSIM / regional SIM configuration","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 6","storage":"256 GB"}'
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,slug=excluded.slug,brand=excluded.brand,model=excluded.model,description=excluded.description,
  condition=excluded.condition,price_in_cents=excluded.price_in_cents,currency=excluded.currency,stock=excluded.stock,
  active=excluded.active,seo_title=excluded.seo_title,seo_description=excluded.seo_description,
  warranty_months=excluded.warranty_months,battery_health=excluded.battery_health,storage_gb=excluded.storage_gb,
  color=excluded.color,specs_json=excluded.specs_json,updated_at=CURRENT_TIMESTAMP;

INSERT INTO products (
  id,name,slug,brand,model,description,condition,price_in_cents,currency,stock,active,
  seo_title,seo_description,warranty_months,battery_health,storage_gb,color,specs_json
) VALUES
(
  'prod-iphone-18-pro-max',
  'Apple iPhone 18 Pro Max 256 GB',
  'iphone-18-pro-max',
  'Apple',
  'iPhone 18 Pro Max',
  'iPhone 18 Pro Max de 256 GB con chip A20 Pro, cámara Fusion principal de 48 MP con apertura variable, pantalla ProMotion y conectividad 5G.',
  'NEW',613990000,'COP',0,1,
  'iPhone 18 Pro Max 256 GB | Comprar en Colombia',
  'Apple iPhone 18 Pro Max de 256 GB con A20 Pro, pantalla Super Retina XDR de 6,9 pulgadas, cámara Fusion de 48 MP y 5G.',
  12,NULL,256,'Plata',
  '{"ramGb":"12","display":"6.9-inch Super Retina XDR OLED","refreshRateHz":"120","processor":"Apple A20 Pro","rearCamera":"48 MP Fusion triple Pro camera with variable aperture","frontCamera":"18 MP Center Stage","battery":"Up to 43 hours video playback","charging":"Up to 50% in about 15 minutes with compatible adapter","network":"5G","os":"iOS 26","waterResistance":"IP68","sim":"eSIM / regional SIM configuration","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 6","storage":"256 GB"}'
),
(
  'prod-galaxy-s26-ultra',
  'Samsung Galaxy S26 Ultra 256 GB',
  'samsung-galaxy-s26-ultra',
  'Samsung',
  'Galaxy S26 Ultra',
  'Galaxy S26 Ultra de 256 GB y 12 GB de RAM con pantalla Dynamic AMOLED 2X, cámara principal de alta resolución, S Pen integrado y 5G.',
  'NEW',369900000,'COP',0,1,
  'Samsung Galaxy S26 Ultra 256 GB | Precio Colombia',
  'Samsung Galaxy S26 Ultra de 256 GB con 12 GB de RAM, pantalla Dynamic AMOLED 2X, cámara Pro, S Pen y conectividad 5G.',
  12,NULL,256,'Negro',
  '{"ramGb":"12","display":"6.9-inch Dynamic AMOLED 2X","refreshRateHz":"120","processor":"Snapdragon flagship platform","rearCamera":"200 MP main camera with multi-camera system","frontCamera":"12 MP","battery":"5000 mAh","charging":"Fast wired and wireless charging","network":"5G","os":"Android","waterResistance":"IP68","sim":"Dual SIM / eSIM by market","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 6","stylus":"Integrated S Pen","storage":"256 GB"}'
),
(
  'prod-galaxy-s25-ultra-256',
  'Samsung Galaxy S25 Ultra 256 GB',
  'samsung-galaxy-s25-ultra-256',
  'Samsung',
  'Galaxy S25 Ultra',
  'Galaxy S25 Ultra de 256 GB y 12 GB de RAM con titanio, S Pen integrado, pantalla de 6,9 pulgadas y sistema avanzado de cámaras.',
  'NEW',399900000,'COP',0,1,
  'Samsung Galaxy S25 Ultra 256 GB | Precio Colombia',
  'Samsung Galaxy S25 Ultra 256 GB con 12 GB de RAM, titanio, S Pen, pantalla de 6,9 pulgadas, cámaras avanzadas y 5G.',
  12,NULL,256,'Titanium Gray',
  '{"ramGb":"12","display":"6.9-inch Dynamic AMOLED 2X","refreshRateHz":"120","processor":"Snapdragon 8 Elite for Galaxy","rearCamera":"200 MP main camera with ultra-wide and telephoto system","frontCamera":"12 MP","battery":"5000 mAh","charging":"45 W wired charging","network":"5G","os":"Android 15 / One UI","waterResistance":"IP68","sim":"Dual SIM / eSIM by market","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 5.4","stylus":"Integrated S Pen","storage":"256 GB"}'
),
(
  'prod-xiaomi-15-ultra-512',
  'Xiaomi 15 Ultra 512 GB',
  'xiaomi-15-ultra-512',
  'Xiaomi',
  'Xiaomi 15 Ultra',
  'Xiaomi 15 Ultra de 512 GB y 16 GB de RAM con sistema de cámaras Leica, pantalla AMOLED LTPO y plataforma Snapdragon de gama alta.',
  'NEW',583050700,'COP',0,1,
  'Xiaomi 15 Ultra 512 GB 16 GB RAM | Colombia',
  'Xiaomi 15 Ultra de 512 GB y 16 GB de RAM con cámaras Leica, pantalla AMOLED LTPO, Snapdragon 8 Elite y conectividad 5G.',
  12,NULL,512,'Plata',
  '{"ramGb":"16","display":"6.73-inch AMOLED LTPO","refreshRateHz":"120","processor":"Snapdragon 8 Elite","rearCamera":"Leica quad-camera system with 1-inch main sensor","frontCamera":"32 MP","battery":"5410 mAh","charging":"90 W wired / 80 W wireless","network":"5G","os":"Android / HyperOS","waterResistance":"IP68","sim":"Dual SIM","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 5.4","storage":"512 GB"}'
),
(
  'prod-oneplus-13-512',
  'OnePlus 13 512 GB',
  'oneplus-13-512',
  'OnePlus',
  'OnePlus 13',
  'OnePlus 13 de 512 GB y 12 GB de RAM con Snapdragon 8 Elite, pantalla LTPO de alta frecuencia y cámara Hasselblad.',
  'NEW',260467600,'COP',0,1,
  'OnePlus 13 512 GB 12 GB RAM | Colombia',
  'OnePlus 13 de 512 GB y 12 GB de RAM con Snapdragon 8 Elite, pantalla LTPO 120 Hz, cámara Hasselblad y 5G.',
  12,NULL,512,'Negro Eclipse',
  '{"ramGb":"12","display":"6.82-inch LTPO AMOLED","refreshRateHz":"120","processor":"Snapdragon 8 Elite","rearCamera":"50 MP triple Hasselblad camera","frontCamera":"32 MP","battery":"6000 mAh","charging":"100 W wired / 50 W wireless","network":"5G","os":"Android 15 / OxygenOS","waterResistance":"IP68/IP69","sim":"Dual SIM","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 5.4","storage":"512 GB"}'
),
(
  'prod-honor-magic7-pro-512',
  'HONOR Magic7 Pro 512 GB',
  'honor-magic7-pro-512',
  'HONOR',
  'Magic7 Pro',
  'HONOR Magic7 Pro de 512 GB y 12 GB de RAM con pantalla LTPO, cámaras premium, batería de gran capacidad y 5G.',
  'NEW',572338600,'COP',0,1,
  'HONOR Magic7 Pro 512 GB 12 GB RAM | Colombia',
  'HONOR Magic7 Pro de 512 GB y 12 GB de RAM con cámara premium, pantalla LTPO, batería de alta capacidad y 5G.',
  12,NULL,512,'Negro',
  '{"ramGb":"12","display":"6.8-inch LTPO OLED","refreshRateHz":"120","processor":"Snapdragon 8 Elite","rearCamera":"50 MP triple camera system","frontCamera":"50 MP + 3D depth camera","battery":"5850 mAh","charging":"100 W wired / 80 W wireless","network":"5G","os":"Android / MagicOS","waterResistance":"IP68","sim":"Dual SIM","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 5.4","storage":"512 GB"}'
),
(
  'prod-motorola-edge-60-pro-512',
  'Motorola Edge 60 Pro 512 GB',
  'motorola-edge-60-pro-512',
  'Motorola',
  'Edge 60 Pro',
  'Motorola Edge 60 Pro de 512 GB y 12 GB de RAM con pantalla pOLED 120 Hz, cámara de 50 MP, batería de 6000 mAh y 5G.',
  'NEW',223990000,'COP',0,1,
  'Motorola Edge 60 Pro 512 GB | Precio Colombia',
  'Motorola Edge 60 Pro de 512 GB y 12 GB de RAM con pantalla pOLED 120 Hz, batería de 6000 mAh, cámara de 50 MP y 5G.',
  12,NULL,512,'Cobalto',
  '{"ramGb":"12","display":"6.7-inch pOLED","refreshRateHz":"120","processor":"MediaTek Dimensity 8350 Extreme","rearCamera":"50 MP triple camera with telephoto","frontCamera":"50 MP","battery":"6000 mAh","charging":"90 W wired / 15 W wireless","network":"5G","os":"Android","waterResistance":"IP68/IP69","sim":"Dual SIM / eSIM by market","wifi":"Wi-Fi 6E","bluetooth":"Bluetooth 5.4","storage":"512 GB"}'
),
(
  'prod-realme-16-pro-512',
  'realme 16 Pro 512 GB',
  'realme-16-pro-512',
  'realme',
  '16 Pro',
  'realme 16 Pro de 512 GB y 12 GB de RAM con pantalla AMOLED de 144 Hz, cámara principal de 200 MP y batería de 7000 mAh.',
  'NEW',284357000,'COP',0,1,
  'realme 16 Pro 512 GB 12 GB RAM | Colombia',
  'realme 16 Pro de 512 GB y 12 GB de RAM con AMOLED 144 Hz, cámara de 200 MP, batería de 7000 mAh y carga de 80 W.',
  12,NULL,512,'Titan',
  '{"ramGb":"12","display":"6.78-inch AMOLED","refreshRateHz":"144","processor":"MediaTek Dimensity 7300 Max Pro","rearCamera":"200 MP LumaColor main camera","frontCamera":"32 MP","battery":"7000 mAh","charging":"80 W wired","network":"5G","os":"Android","waterResistance":"IP68","sim":"Dual SIM","wifi":"Wi-Fi 6","bluetooth":"Bluetooth 5.4","storage":"512 GB"}'
),
(
  'prod-poco-f8-pro-512',
  'POCO F8 Pro 512 GB',
  'poco-f8-pro-512',
  'POCO',
  'F8 Pro',
  'POCO F8 Pro de 512 GB con plataforma Snapdragon de gama alta, pantalla AMOLED 120 Hz, cámara de 50 MP y conectividad 5G.',
  'NEW',267990000,'COP',0,1,
  'POCO F8 Pro 512 GB | Precio Colombia',
  'POCO F8 Pro de 512 GB con pantalla AMOLED 120 Hz, cámara de 50 MP, plataforma Snapdragon, batería de gran capacidad y 5G.',
  12,NULL,512,'Plata',
  '{"ramGb":"12","display":"6.59-inch AMOLED","refreshRateHz":"120","processor":"Snapdragon flagship platform","rearCamera":"50 MP triple camera","frontCamera":"20 MP","battery":"6500 mAh","charging":"100 W wired","network":"5G","os":"Android / HyperOS","waterResistance":"IP68","sim":"Dual SIM","wifi":"Wi-Fi 7","bluetooth":"Bluetooth 5.4","storage":"512 GB"}'
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,slug=excluded.slug,brand=excluded.brand,model=excluded.model,description=excluded.description,
  condition=excluded.condition,price_in_cents=excluded.price_in_cents,currency=excluded.currency,stock=excluded.stock,
  active=excluded.active,seo_title=excluded.seo_title,seo_description=excluded.seo_description,
  warranty_months=excluded.warranty_months,battery_health=excluded.battery_health,storage_gb=excluded.storage_gb,
  color=excluded.color,specs_json=excluded.specs_json,updated_at=CURRENT_TIMESTAMP;

DELETE FROM product_images
WHERE product_id IN (
  'prod-iphone-17-pro-max','prod-iphone-18-pro-max','prod-galaxy-s26-ultra','prod-galaxy-s25-ultra-256',
  'prod-xiaomi-15-ultra-512','prod-oneplus-13-512','prod-honor-magic7-pro-512',
  'prod-motorola-edge-60-pro-512','prod-realme-16-pro-512','prod-poco-f8-pro-512'
);

INSERT INTO product_images (id,product_id,url,alt_text,sort_order) VALUES
('img-iphone-17-pro-max-1','prod-iphone-17-pro-max','https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro_Max.jpg','Apple iPhone 17 Pro Max',0),
('img-iphone-18-pro-max-1','prod-iphone-18-pro-max','https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_18_Pro_Max_black_rear.jpg','Apple iPhone 18 Pro Max negro',0),
('img-galaxy-s26-ultra-1','prod-galaxy-s26-ultra','https://commons.wikimedia.org/wiki/Special:Redirect/file/Galaxy_S26_Ultra_-_1.jpg','Samsung Galaxy S26 Ultra',0),
('img-galaxy-s25-ultra-1','prod-galaxy-s25-ultra-256','https://commons.wikimedia.org/wiki/Special:Redirect/file/Samsung_Galaxy_S25_Ultra_2025_(1).jpg','Samsung Galaxy S25 Ultra',0),
('img-xiaomi-15-ultra-1','prod-xiaomi-15-ultra-512','https://commons.wikimedia.org/wiki/Special:Redirect/file/Xiaomi_15_Ultra.jpg','Xiaomi 15 Ultra',0),
('img-oneplus-13-1','prod-oneplus-13-512','https://commons.wikimedia.org/wiki/Special:Redirect/file/OnePlus_13_back.jpg','OnePlus 13 negro',0),
('img-honor-magic7-pro-1','prod-honor-magic7-pro-512','https://commons.wikimedia.org/wiki/Special:Redirect/file/Honor_Magic_7_Pro_(May_1,_2025).jpg','HONOR Magic7 Pro',0),
('img-motorola-edge-60-pro-1','prod-motorola-edge-60-pro-512','https://commons.wikimedia.org/wiki/Special:Redirect/file/Motorola_Edge_60_Pro.jpg','Motorola Edge 60 Pro',0),
('img-realme-16-pro-1','prod-realme-16-pro-512','https://commons.wikimedia.org/wiki/Special:Redirect/file/Smartphone_The_realme_16_Pro_2026-08-11_Titan_battery_01.jpg','realme 16 Pro',0),
('img-poco-f8-pro-1','prod-poco-f8-pro-512','https://commons.wikimedia.org/wiki/Special:Redirect/file/POCO_F8_Pro_frame.jpg','POCO F8 Pro',0);

DELETE FROM product_categories
WHERE product_id IN (
  'prod-iphone-17-pro-max','prod-iphone-18-pro-max','prod-galaxy-s26-ultra','prod-galaxy-s25-ultra-256',
  'prod-xiaomi-15-ultra-512','prod-oneplus-13-512','prod-honor-magic7-pro-512',
  'prod-motorola-edge-60-pro-512','prod-realme-16-pro-512','prod-poco-f8-pro-512'
);

INSERT OR IGNORE INTO product_categories(product_id,category_id) VALUES
('prod-iphone-17-pro-max','cat-smartphones'),('prod-iphone-17-pro-max','cat-apple'),('prod-iphone-17-pro-max','cat-5g'),
('prod-iphone-18-pro-max','cat-smartphones'),('prod-iphone-18-pro-max','cat-apple'),('prod-iphone-18-pro-max','cat-5g'),
('prod-galaxy-s26-ultra','cat-smartphones'),('prod-galaxy-s26-ultra','cat-samsung'),('prod-galaxy-s26-ultra','cat-android-premium'),('prod-galaxy-s26-ultra','cat-5g'),
('prod-galaxy-s25-ultra-256','cat-smartphones'),('prod-galaxy-s25-ultra-256','cat-samsung'),('prod-galaxy-s25-ultra-256','cat-android-premium'),('prod-galaxy-s25-ultra-256','cat-5g'),
('prod-xiaomi-15-ultra-512','cat-smartphones'),('prod-xiaomi-15-ultra-512','cat-android-premium'),('prod-xiaomi-15-ultra-512','cat-5g'),
('prod-oneplus-13-512','cat-smartphones'),('prod-oneplus-13-512','cat-android-premium'),('prod-oneplus-13-512','cat-5g'),
('prod-honor-magic7-pro-512','cat-smartphones'),('prod-honor-magic7-pro-512','cat-android-premium'),('prod-honor-magic7-pro-512','cat-5g'),
('prod-motorola-edge-60-pro-512','cat-smartphones'),('prod-motorola-edge-60-pro-512','cat-android-alta'),('prod-motorola-edge-60-pro-512','cat-5g'),
('prod-realme-16-pro-512','cat-smartphones'),('prod-realme-16-pro-512','cat-android-alta'),('prod-realme-16-pro-512','cat-5g'),
('prod-poco-f8-pro-512','cat-smartphones'),('prod-poco-f8-pro-512','cat-android-alta'),('prod-poco-f8-pro-512','cat-5g');

DELETE FROM product_variants
WHERE product_id IN (
  'prod-iphone-17-pro-max','prod-iphone-18-pro-max','prod-galaxy-s26-ultra','prod-galaxy-s25-ultra-256',
  'prod-xiaomi-15-ultra-512','prod-oneplus-13-512','prod-honor-magic7-pro-512',
  'prod-motorola-edge-60-pro-512','prod-realme-16-pro-512','prod-poco-f8-pro-512'
);

INSERT INTO product_variants(id,product_id,name,options_json,price_in_cents,active,sort_order) VALUES
('var-iphone-17-256-deep-blue','prod-iphone-17-pro-max','256 GB · Azul profundo','{"storageGb":256,"color":"Azul profundo"}',464900000,1,0),
('var-iphone-17-512-deep-blue','prod-iphone-17-pro-max','512 GB · Azul profundo','{"storageGb":512,"color":"Azul profundo"}',755000000,1,1),
('var-iphone-18-256-silver','prod-iphone-18-pro-max','256 GB · Plata','{"storageGb":256,"color":"Plata"}',613990000,1,0),
('var-iphone-18-512-silver','prod-iphone-18-pro-max','512 GB · Plata','{"storageGb":512,"color":"Plata"}',724900000,1,1),
('var-s26-256-black','prod-galaxy-s26-ultra','256 GB · Negro','{"storageGb":256,"color":"Negro","ramGb":12}',369900000,1,0),
('var-s26-512-black','prod-galaxy-s26-ultra','512 GB · Negro','{"storageGb":512,"color":"Negro","ramGb":12}',423249200,1,1),
('var-s25-256-gray','prod-galaxy-s25-ultra-256','256 GB · Titanium Gray','{"storageGb":256,"color":"Titanium Gray","ramGb":12}',399900000,1,0),
('var-xiaomi-15-512-silver','prod-xiaomi-15-ultra-512','512 GB · Plata','{"storageGb":512,"color":"Plata","ramGb":16}',583050700,1,0),
('var-oneplus-13-512-black','prod-oneplus-13-512','512 GB · Black Eclipse','{"storageGb":512,"color":"Black Eclipse","ramGb":12}',260467600,1,0),
('var-honor-magic7-512-black','prod-honor-magic7-pro-512','512 GB · Negro','{"storageGb":512,"color":"Negro","ramGb":12}',572338600,1,0),
('var-motorola-edge60-512-cobalt','prod-motorola-edge-60-pro-512','512 GB · Cobalto','{"storageGb":512,"color":"Cobalto","ramGb":12}',223990000,1,0),
('var-realme16-512-titan','prod-realme-16-pro-512','512 GB · Titan','{"storageGb":512,"color":"Titan","ramGb":12}',284357000,1,0),
('var-poco-f8-512-silver','prod-poco-f8-pro-512','512 GB · Plata','{"storageGb":512,"color":"Plata","ramGb":12}',267990000,1,0);
