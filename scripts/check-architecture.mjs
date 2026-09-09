import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = join(process.cwd(), "modules");
const forbiddenExternal = /(?:cloudflare|@cloudflare|next|react|resend|stripe|mercadopago|paypal|wompi|binance)/i;
const layerNames = new Set(["domain", "application", "infrastructure", "presentation"]);
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) await inspect(path);
  }
}

async function inspect(path) {
  const source = await readFile(path, "utf8");
  const layer = relative(root, path).split(/[\\/]/)[1];
  if (!layerNames.has(layer)) return;

  const imports = [...source.matchAll(/(?:import|export)\s+(?:type\s+)?[^;]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  for (const specifier of imports) {
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

await walk(root);

if (violations.length > 0) {
  console.error("Architecture boundary violations detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Architecture boundary check passed.");
