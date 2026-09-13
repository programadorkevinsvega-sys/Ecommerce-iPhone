import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const roots = [
  join(process.cwd(), "apps", "web", "app"),
  join(process.cwd(), "apps", "web", "components"),
  join(process.cwd(), "apps", "web", "lib"),
];
const extensions = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const forbiddenMarkers = /\b(mock|mocks|demo|fake|dummy|fixture|sample|hardcoded|InMemory|TODO)\b/i;
const forbiddenBusinessNames = /\b(?:mock|fake|demo|dummy|fixture|sample|seed|fallback)(?:[A-Z_][A-Za-z0-9_]*)?\s*(?:Products?|Users?|Customers?|Orders?|Reviews?|Services?|Promotions?|Inventory|Prices?|Credentials?)\b/i;
const forbiddenSensitiveValues = /(?:admin@(?:example\.(?:com|org)|test\.(?:com|org))|(?:demo|fake|test)@(?:example\.(?:com|org)|test\.(?:com|org))|password(?:123|1234|!|@)|secret(?:123|1234)?|token(?:123|demo)|\b(?:555)[- .]?\d{3}[- .]?\d{4}\b)/i;
const forbiddenInMemoryImport = /(?:from\s+["'][^"']*InMemoryProductRepository|require\s*\(\s*["'][^"']*InMemoryProductRepository)/i;
const businessPriceLiteral = /(?:priceInCents|unitPriceInCents|totalInCents|shippingInCents|discountInCents)\s*[:=]\s*\d+/i;

const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      await walk(path);
      continue;
    }
    if (!extensions.test(entry.name)) continue;
    await inspect(path);
  }
}

async function inspect(path) {
  const source = await readFile(path, "utf8");
  const file = relative(process.cwd(), path);
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (forbiddenMarkers.test(line)) {
      violations.push(`${file}:${lineNumber}: forbidden production-data marker: ${line.trim()}`);
    }
    if (forbiddenBusinessNames.test(line)) {
      violations.push(`${file}:${lineNumber}: mock/demo business-data identifier: ${line.trim()}`);
    }
    if (forbiddenSensitiveValues.test(line)) {
      violations.push(`${file}:${lineNumber}: demo/test credential or sensitive sample value: ${line.trim()}`);
    }
    if (forbiddenInMemoryImport.test(line)) {
      violations.push(`${file}:${lineNumber}: production frontend cannot import InMemoryProductRepository`);
    }
    if (businessPriceLiteral.test(line)) {
      violations.push(`${file}:${lineNumber}: frontend must not hardcode business price fields: ${line.trim()}`);
    }
  });
}

for (const root of roots) await walk(root);

if (violations.length) {
  console.error("Frontend production-data check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Frontend production-data check passed: no mock/demo business data, demo credentials, production InMemory repository imports, or hardcoded business price fields were found in the production frontend paths.");
