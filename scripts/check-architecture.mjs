import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = join(process.cwd(), "modules");
const apiRoot = join(process.cwd(), "apps", "web", "app", "api");
const forbiddenExternal = /(?:cloudflare|@cloudflare|next|react|resend|stripe|mercadopago|paypal|wompi|binance)/i;
const layerNames = new Set(["domain", "application", "infrastructure", "presentation"]);
const violations = [];

async function walk(directory, inspector = inspect) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, inspector);
    else if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) await inspector(path);
  }
}

function importsOf(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:type\s+)?[^;]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

async function inspect(path) {
  const source = await readFile(path, "utf8");
  const layer = relative(root, path).split(/[\\/]/)[1];
  if (!layerNames.has(layer)) return;

  for (const specifier of importsOf(source)) {
    if (layer === "domain" && (specifier.includes("/application/") || specifier.includes("/infrastructure/") || specifier.includes("/presentation/") || forbiddenExternal.test(specifier))) {
      violations.push(`${relative(process.cwd(), path)}: domain import is not allowed: ${specifier}`);
    }
    if (layer === "application" && (specifier.includes("/infrastructure/") || specifier.includes("/presentation/") || forbiddenExternal.test(specifier))) {
      violations.push(`${relative(process.cwd(), path)}: application import is not allowed: ${specifier}`);
    }
    if (specifier.startsWith("../../") && layer !== "domain" && layer !== "application") {
      const target = specifier.split("/")[2];
      if (target && target !== "shared-kernel" && layerNames.has(specifier.split("/")[3])) {
        violations.push(`${relative(process.cwd(), path)}: cross-context internal import is not allowed: ${specifier}`);
      }
    }
  }
}

async function inspectApiRoute(path) {
  if (!path.endsWith("route.ts")) return;
  const source = await readFile(path, "utf8");
  const file = relative(process.cwd(), path);
  const imports = importsOf(source);

  for (const specifier of imports) {
    if (/\/infrastructure(?:\/|$)/.test(specifier) || /@cloudflare|@opennextjs\/cloudflare/.test(specifier)) {
      violations.push(`${file}: API presentation cannot import infrastructure/runtime adapters directly: ${specifier}`);
    }
    if (/modules\/[^/]+\/domain/.test(specifier)) {
      violations.push(`${file}: API presentation cannot import domain internals directly: ${specifier}`);
    }
  }

  if (/\.prepare\s*\(/.test(source) || /\.batch\s*\(/.test(source)) {
    violations.push(`${file}: API presentation cannot execute database statements directly`);
  }
}

await walk(root, inspect);
await walk(apiRoot, inspectApiRoute);

if (violations.length > 0) {
  console.error("Architecture boundary violations detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Architecture boundary check passed for modules and API presentation.");
