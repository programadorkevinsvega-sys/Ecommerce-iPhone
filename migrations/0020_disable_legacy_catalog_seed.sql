UPDATE products
SET active = 0,
    stock = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  'prod-iphone-17-pro-max',
  'prod-galaxy-s25-ultra',
  'prod-iphone-16-pro'
);
