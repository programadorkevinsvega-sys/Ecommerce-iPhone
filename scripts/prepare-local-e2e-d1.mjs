import { execFileSync } from "node:child_process";

const legacyCatalogBootstrap = `
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

INSERT OR IGNORE INTO products (
  id, name, slug, brand, model, description, condition, price_in_cents,
  currency, stock, active, warranty_months, specs_json
) VALUES
  (
    'prod-iphone-17-pro-max',
    'Apple iPhone 17 Pro Max (legacy migration fixture)',
    'iphone-17-pro-max-legacy-migration-fixture',
    'Apple',
    'iPhone 17 Pro Max',
    'Local-only parent row required by the historical storefront variant migration.',
    'NEW',
    649990000,
    'COP',
    0,
    0,
    12,
    '{}'
  ),
  (
    'prod-galaxy-s25-ultra',
    'Samsung Galaxy S25 Ultra (legacy migration fixture)',
    'samsung-galaxy-s25-ultra-legacy-migration-fixture',
    'Samsung',
    'Galaxy S25 Ultra',
    'Local-only parent row required by the historical storefront variant migration.',
    'NEW',
    529990000,
    'COP',
    0,
    0,
    12,
    '{}'
  ),
  (
    'prod-iphone-16-pro',
    'Apple iPhone 16 Pro (legacy migration fixture)',
    'iphone-16-pro-legacy-migration-fixture',
    'Apple',
    'iPhone 16 Pro',
    'Local-only parent row required by the historical storefront variant migration.',
    'NEW',
    389990000,
    'COP',
    0,
    0,
    12,
    '{}'
  );
`;

function run(command, args) {
  execFileSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
}

console.log("Preparing local-only legacy catalog parents for historical migrations.");
run("pnpm", [
  "exec",
  "wrangler",
  "d1",
  "execute",
  "ecommerce-iphone",
  "--local",
  "--command",
  legacyCatalogBootstrap,
]);

console.log("Applying the complete migration history to isolated local D1.");
run("pnpm", ["db:migrate:local"]);

console.log("Seeding deterministic inventory fixtures for local checkout E2E.");
run("pnpm", [
  "exec",
  "wrangler",
  "d1",
  "execute",
  "ecommerce-iphone",
  "--local",
  "--command",
  [
    "UPDATE products SET stock=100,updated_at=CURRENT_TIMESTAMP WHERE id='prod-iphone-17-pro-max' AND active=1;",
    "UPDATE products SET stock=0,updated_at=CURRENT_TIMESTAMP WHERE id='prod-iphone-18-pro-max' AND active=1;",
    "UPDATE product_variants SET price_in_cents=464900000 WHERE id='var-iphone-17-256-deep-blue' AND product_id='prod-iphone-17-pro-max';",
  ].join("\n"),
]);

console.log("Local E2E D1 database is ready.");
