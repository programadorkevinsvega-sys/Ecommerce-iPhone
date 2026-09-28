import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const roots = [
  join(process.cwd(), "apps", "web", "app"),
  join(process.cwd(), "apps", "web", "components"),
  join(process.cwd(), "apps", "web", "lib"),
];
const extensions = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const forbiddenMarkers = /\b(mock|mocks|demo|fake|dummy|fixture|sample|hardcoded|InMemory)\b/i;
const forbiddenTodoMarker = /(^|[\s(/:*])TODO(?=($|[\s):,.;*/]))/;
const forbiddenBusinessNames = /\b(?:mock|fake|demo|dummy|fixture|sample|seed|fallback)(?:[A-Z_][A-Za-z0-9_]*)?\s*(?:Products?|Users?|Customers?|Orders?|Reviews?|Services?|Promotions?|Inventory|Prices?|Credentials?)\b/i;
const forbiddenSensitiveValues = /(?:admin@(?:example\.(?:com|org)|test\.(?:com|org))|(?:demo|fake|test)@(?:example\.(?:com|org)|test\.(?:com|org))|password(?:123|1234|!|@)|secret(?:123|1234)|token(?:123|demo)|\b(?:555)[- .]?\d{3}[- .]?\d{4}\b)/i;
const forbiddenInMemoryImport = /(?:from\s+["'][^"']*InMemoryProductRepository|require\s*\(\s*["'][^"']*InMemoryProductRepository)/i;
const businessPriceLiteral = /(?:priceInCents|unitPriceInCents|totalInCents|shippingInCents|discountInCents)\s*[:=]\s*\d+/i;
const forbiddenBrowserStorage = /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/i;
const forbiddenBrowserLogging = /\bconsole\.(?:log|error|warn|info|debug|trace)\s*\(/i;
const forbiddenDebugStatement = /\bdebugger\b/;
const forbiddenSensitiveQueryKey = [
  /new\s+URLSearchParams\s*\([^)]*?(?:token|access_token|refresh_token|password|secret|api[_-]?key|authorization|bearer|cvv|cvc|card(?:_number|Number)?|iban)/i,
  /(?:URLSearchParams|searchParams)\s*\.\s*(?:set|append|has|get)\s*\(\s*["'`]\s*(?:token|access_token|refresh_token|password|secret|api[_-]?key|authorization|bearer|cvv|cvc|card(?:_number|Number)?|iban)\s*["'`]/i,
  /(?:router\.(?:push|replace)|history\.(?:pushState|replaceState))\s*\([^)]*?[?&](?:token|access_token|refresh_token|password|secret|api[_-]?key|authorization|bearer|cvv|cvc|card(?:_number|Number)?|iban)=/i,
  /(?:location\.(?:search|href))\s*=\s*[^;\n]*[?&](?:token|access_token|refresh_token|password|secret|api[_-]?key|authorization|bearer|cvv|cvc|card(?:_number|Number)?|iban)=/i,
];
const forbiddenHardcodedSecrets = /\b(?:secretKey|privateKey|accessToken|apiKey|apiSecret|clientSecret|integritySecret|certificateSN|secret|token)\b\s*(?:[:=]|=>)\s*["'][^"']+["']/i;
const forbiddenCardData = /\b(?:cardNumber|card_number|cvv|cvc|securityCode|security_code)\b/i;

const violations = [];

function isFrontendPath(path) {
  const normalized = relative(process.cwd(), path).replaceAll("\\", "/");
  return !normalized.startsWith("apps/web/app/api/");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      await walk(path);
      continue;
    }
    if (!extensions.test(entry.name) || !isFrontendPath(path) || /\.(?:test|spec)\.[^.]+$/.test(entry.name)) continue;
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
    if (forbiddenTodoMarker.test(line)) {
      violations.push(file + ":" + lineNumber + ": forbidden production-data marker: " + line.trim());
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
    if (forbiddenBrowserStorage.test(line)) {
      violations.push(`${file}:${lineNumber}: frontend must not persist or read browser storage/cookies directly: ${line.trim()}`);
    }
    if (forbiddenBrowserLogging.test(line)) {
      violations.push(`${file}:${lineNumber}: frontend must not log browser data: ${line.trim()}`);
    }
    if (forbiddenDebugStatement.test(line)) {
      violations.push(`${file}:${lineNumber}: frontend must not contain debugger statements: ${line.trim()}`);
    }
    if (forbiddenSensitiveQueryKey.some((pattern) => pattern.test(line))) {
      violations.push(`${file}:${lineNumber}: sensitive credentials/payment data must not be placed in browser URLs or query strings: ${line.trim()}`);
    }
    if (forbiddenHardcodedSecrets.test(line)) {
      violations.push(`${file}:${lineNumber}: frontend must not contain server secret/private key/access token variables: ${line.trim()}`);
    }
    if (forbiddenCardData.test(line)) {
      violations.push(`${file}:${lineNumber}: frontend must not handle raw card number/CVV/security-code fields: ${line.trim()}`);
    }
  });
}

for (const root of roots) await walk(root);

if (violations.length) {
  console.error("Frontend production-data check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Frontend production-data check passed: no mock/demo business data, demo credentials, production InMemory repository imports, hardcoded business price fields, browser storage/cookie access, console logging, debugger statements, sensitive URL/query data, server-side secrets, or raw card/CVV fields were found in the production frontend paths.");
