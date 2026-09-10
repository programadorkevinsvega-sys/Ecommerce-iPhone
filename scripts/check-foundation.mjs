import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "wrangler.jsonc",
  ".env.example",
  ".gitignore",
  "docs/architecture.md",
  "docs/development.md",
  "docs/foundation.md",
  "docs/rollback.md",
  "scripts/check-architecture.mjs",
  "apps/web/next.config.ts",
  "apps/web/middleware.ts",
  "apps/web/worker.ts",
  "scripts/check-foundation.mjs",
  ".github/workflows/ci.yml",
];

const failures = [];
for (const file of requiredFiles) {
  try { await access(file); } catch { failures.push(`missing required foundation file: ${file}`); }
}

const wrangler = await readFile("wrangler.jsonc", "utf8");
for (const environment of ["development", "staging"]) {
  if (!wrangler.includes(`\"${environment}\"`)) failures.push(`wrangler environment is not declared: ${environment}`);
}
for (const binding of ["API_RATE_LIMITER", "SENSITIVE_RATE_LIMITER"]) {
  if (!wrangler.includes(`\"name\": \"${binding}\"`)) failures.push(`rate-limit binding is not declared: ${binding}`);
}
for (const path of ["/api/health/live", "/api/health/ready"]) {
  if (path === "/api/health/live" && !await fileContains("apps/web/worker.ts", path)) failures.push("liveness endpoint is not enforced by the Worker");
  if (path === "/api/health/ready" && !await fileContains("apps/web/worker.ts", path)) failures.push("readiness endpoint is not enforced by the Worker");
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
for (const script of ["architecture:check", "foundation:check", "typecheck", "test", "build", "build:cloudflare", "format:check"]) {
  if (!packageJson.scripts?.[script]) failures.push(`missing root quality script: ${script}`);
}

const gitignore = await readFile(".gitignore", "utf8");
for (const entry of [".env", ".env.*", ".dev.vars", ".dev.vars.*"]) {
  if (!gitignore.includes(entry)) failures.push(`secret file is not ignored: ${entry}`);
}

const ci = await readFile(".github/workflows/ci.yml", "utf8");
if (!ci.includes("pnpm install --frozen-lockfile")) failures.push("CI must use frozen lockfile installation");
if (!ci.includes("pnpm foundation:check")) failures.push("CI must run foundation:check");
if (!ci.includes("pnpm architecture:check")) failures.push("CI must run architecture:check");

if (failures.length) {
  console.error("Foundation invariant check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation invariant check passed.");

async function fileContains(file, value) {
  const content = await readFile(file, "utf8");
  return content.includes(value);
}
