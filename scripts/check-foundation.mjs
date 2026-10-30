import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "package.json",
  "pnpm-lock.yaml",
  ".npmrc",
  ".node-version",
  "wrangler.jsonc",
  ".env.example",
  ".gitignore",
  "docs/architecture.md",
  "docs/development.md",
  "docs/foundation.md",
  "docs/rollback.md",
  "scripts/check-architecture.mjs",
  "scripts/check-foundation.mjs",
  "scripts/verify-install.mjs",
  "scripts/verify-production.mjs",
  "scripts/assert-main-deploy.mjs",
  "apps/web/next.config.ts",
  "apps/web/middleware.ts",
  "apps/web/worker.ts",
  "apps/web/app/api/admin/resources/route.ts",
  ".github/workflows/payment-consistency.yml",
  ".github/workflows/production-verification.yml",
  ".github/workflows/rollback.yml",
];

const failures = [];
for (const file of requiredFiles) {
  try { await access(file); } catch { failures.push(`missing required foundation file: ${file}`); }
}

const wrangler = await readFile("wrangler.jsonc", "utf8");
for (const binding of ["API_RATE_LIMITER", "SENSITIVE_RATE_LIMITER"]) {
  if (!wrangler.includes(`\"name\": \"${binding}\"`)) failures.push(`rate-limit binding is not declared: ${binding}`);
}

const worker = await readFile("apps/web/worker.ts", "utf8");
if (!worker.includes("nextWorker.fetch")) failures.push("Worker must delegate HTTP requests to OpenNext");
if (!worker.includes("API_RATE_LIMITER")) failures.push("Worker must enforce API rate limiting");
if (!worker.includes("SENSITIVE_RATE_LIMITER")) failures.push("Worker must enforce sensitive route rate limiting");
if (!worker.includes('url.pathname === "/api/health/live"')) failures.push("Worker must expose liveness handling");
if (!worker.includes('url.pathname === "/api/health/ready"')) failures.push("Worker must expose readiness handling");

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.packageManager !== "pnpm@12.4.1") failures.push("packageManager must pin pnpm@12.4.1");
if (packageJson.engines?.node !== "24.18.0") failures.push("package.json must pin Node.js 24.18.0");
for (const script of ["architecture:check", "foundation:check", "typecheck", "test", "build", "build:cloudflare", "verify:production", "format:check"]) {
  if (!packageJson.scripts?.[script]) failures.push(`missing root quality script: ${script}`);
}

const npmrc = await readFile(".npmrc", "utf8");
if (!npmrc.includes("frozen-lockfile=true")) failures.push(".npmrc must enforce frozen-lockfile=true");
if (!npmrc.includes("engine-strict=true")) failures.push(".npmrc must enforce engine-strict=true");

const nodeVersion = (await readFile(".node-version", "utf8")).trim();
if (nodeVersion !== "24.18.0") failures.push(".node-version must pin Node.js 24.18.0");

const gitignore = await readFile(".gitignore", "utf8");
for (const entry of [".env", ".env.*", ".dev.vars", ".dev.vars.*"]) {
  if (!gitignore.includes(entry)) failures.push(`secret file is not ignored: ${entry}`);
}

const productionVerification = await readFile(".github/workflows/production-verification.yml", "utf8");
if (!productionVerification.includes("pnpm verify:production")) failures.push("production verification workflow must execute runtime verification");
const workerBuildDeploy = packageJson.scripts?.["cloudflare:deploy"] ?? "";
if (!workerBuildDeploy.includes("intentionally disabled")) {
  failures.push("Cloudflare Workers Builds deploy hook must remain a no-op; production is deployed by GitHub Actions");
}

const guardedProductionDeploy = packageJson.scripts?.["cloudflare:deploy:production"] ?? "";
if (!guardedProductionDeploy.includes("assert-main-deploy.mjs")) failures.push("production deploy must enforce the main-only branch guard");
if (!guardedProductionDeploy.includes("db:migrate:production")) failures.push("GitHub production deploy must apply remote D1 migrations");
if (!guardedProductionDeploy.includes("wrangler deploy")) failures.push("GitHub production deploy must publish the Worker");

const ciWorkflow = await readFile(".github/workflows/payment-consistency.yml", "utf8");
if (!ciWorkflow.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'")) failures.push("production deployment must run only on pushes to main");
if (!ciWorkflow.includes("needs:") || !ciWorkflow.includes("- runner-diagnostics") || !ciWorkflow.includes("- payment-quality")) failures.push("production deployment must depend on successful CI quality jobs");
if (!ciWorkflow.includes("pnpm cloudflare:deploy:production")) failures.push("GitHub Actions must own the guarded production deploy");
if (!ciWorkflow.includes("pnpm db:verify:production")) failures.push("GitHub Actions must verify remote D1 migration state after deployment");

const adminRoute = await readFile("apps/web/app/api/admin/resources/route.ts", "utf8");
if (/\.prepare\s*\(/.test(adminRoute)) failures.push("admin presentation route must not execute SQL directly");
if (/modules\/[^\"']+\/infrastructure/.test(adminRoute)) failures.push("admin presentation route must not import infrastructure directly");

if (failures.length) {
  console.error("Foundation invariant check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation invariant check passed.");
