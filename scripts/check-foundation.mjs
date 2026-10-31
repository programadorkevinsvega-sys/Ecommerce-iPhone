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
  "scripts/verify-changed-format.mjs",
  "scripts/verify-cloudflare-build.mjs",
  "scripts/verify-production.mjs",
  "scripts/assert-main-deploy.mjs",
  "apps/web/next.config.ts",
  "apps/web/middleware.ts",
  "apps/web/worker.ts",
  "apps/web/worker-entry.ts",
  "apps/web/lib/scheduledWorker.ts",
  "apps/web/lib/scheduledTaskRunner.ts",
  "apps/web/lib/scheduledTaskRunner.test.ts",
  "apps/web/lib/mediaCleanupScheduler.ts",
  "apps/web/lib/mediaCleanupScheduler.test.ts",
  "migrations/0043_media_cleanup_scan_state.sql",
  "apps/web/app/api/admin/resources/route.ts",
  ".github/workflows/payment-consistency.yml",
  ".github/workflows/production-verification.yml",
  ".github/workflows/rollback.yml",
];

const failures = [];
for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    failures.push(`missing required foundation file: ${file}`);
  }
}

const wrangler = await readFile("wrangler.jsonc", "utf8");
for (const binding of ["API_RATE_LIMITER", "SENSITIVE_RATE_LIMITER"]) {
  if (!wrangler.includes(`\"name\": \"${binding}\"`))
    failures.push(`rate-limit binding is not declared: ${binding}`);
}

const worker = await readFile("apps/web/worker.ts", "utf8");
if (!worker.includes("nextWorker.fetch"))
  failures.push("Worker must delegate HTTP requests to OpenNext");
if (!worker.includes("API_RATE_LIMITER")) failures.push("Worker must enforce API rate limiting");
if (!worker.includes("SENSITIVE_RATE_LIMITER"))
  failures.push("Worker must enforce sensitive route rate limiting");
if (!worker.includes('url.pathname === "/api/health/live"'))
  failures.push("Worker must expose liveness handling");
if (!worker.includes('url.pathname === "/api/health/ready"'))
  failures.push("Worker must expose readiness handling");

const scheduledWorker = await readFile("apps/web/lib/scheduledWorker.ts", "utf8");
if (!scheduledWorker.includes("runScheduledTasks(tasks)"))
  failures.push("Scheduled Worker must execute maintenance tasks through the isolated task runner");
if (!scheduledWorker.includes("media_cleanup_scan_state"))
  failures.push("R2 orphan cleanup must persist per-prefix pagination cursors in D1");

const workerEntry = await readFile("apps/web/worker-entry.ts", "utf8");
if (!workerEntry.includes("scheduled: runScheduledWorker"))
  failures.push("Wrangler entrypoint must install the isolated scheduled handler");
if (!wrangler.includes('"main": "apps/web/worker-entry.ts"'))
  failures.push("Wrangler must use the entrypoint that installs the isolated scheduled handler");

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.packageManager !== "pnpm@12.4.1")
  failures.push("packageManager must pin pnpm@12.4.1");
if (packageJson.engines?.node !== "24.18.0") failures.push("package.json must pin Node.js 24.18.0");
for (const script of [
  "architecture:check",
  "foundation:check",
  "typecheck",
  "test",
  "build",
  "build:cloudflare",
  "cloudflare:build",
  "verify:cloudflare:build",
  "verify:production",
  "format:check",
  "format:check:changed",
]) {
  if (!packageJson.scripts?.[script]) failures.push(`missing root quality script: ${script}`);
}

const npmrc = await readFile(".npmrc", "utf8");
if (!npmrc.includes("frozen-lockfile=true"))
  failures.push(".npmrc must enforce frozen-lockfile=true");
if (!npmrc.includes("engine-strict=true")) failures.push(".npmrc must enforce engine-strict=true");

const nodeVersion = (await readFile(".node-version", "utf8")).trim();
if (nodeVersion !== "24.18.0") failures.push(".node-version must pin Node.js 24.18.0");

const gitignore = await readFile(".gitignore", "utf8");
for (const entry of [".env", ".env.*", ".dev.vars", ".dev.vars.*"]) {
  if (!gitignore.includes(entry)) failures.push(`secret file is not ignored: ${entry}`);
}

const productionVerification = await readFile(
  ".github/workflows/production-verification.yml",
  "utf8",
);
if (!productionVerification.includes("pnpm verify:production"))
  failures.push("production verification workflow must execute runtime verification");
const workerBuildDeploy = packageJson.scripts?.["cloudflare:deploy"] ?? "";
if (workerBuildDeploy !== "pnpm cloudflare:deploy:production") {
  failures.push("Cloudflare Workers Builds deploy hook must run the guarded production deploy");
}

const guardedProductionDeploy = packageJson.scripts?.["cloudflare:deploy:production"] ?? "";
if (!guardedProductionDeploy.includes("assert-main-deploy.mjs"))
  failures.push("Cloudflare production deploy must enforce the main-only branch guard");
if (!guardedProductionDeploy.includes("db:migrate:production"))
  failures.push("Cloudflare production deploy must apply remote D1 migrations");
if (!guardedProductionDeploy.includes("wrangler deploy"))
  failures.push("Cloudflare production deploy must publish the Worker");

const ciWorkflow = await readFile(".github/workflows/payment-consistency.yml", "utf8");
if (ciWorkflow.includes("deploy-production:"))
  failures.push("GitHub Actions CI must not own the production deployment job");
if (ciWorkflow.includes("pnpm cloudflare:deploy:production"))
  failures.push("GitHub Actions CI must not invoke the production deploy command");
if (ciWorkflow.includes("pnpm db:verify:production"))
  failures.push("GitHub Actions CI must not query remote D1 migrations");
if (ciWorkflow.includes("CLOUDFLARE_API_TOKEN") || ciWorkflow.includes("CLOUDFLARE_ACCOUNT_ID"))
  failures.push("GitHub Actions CI must not require Cloudflare deployment credentials");
if (
  !ciWorkflow.includes("WORKERS_CI_BRANCH=preview") ||
  !ciWorkflow.includes("WORKERS_CI_BRANCH=main") ||
  !ciWorkflow.includes("feature/test")
)
  failures.push("GitHub CI must test the main-only guard against GitHub and Cloudflare branches");

if (!ciWorkflow.includes("node scripts/verify-install.mjs"))
  failures.push("GitHub CI must explicitly verify the installation toolchain");
if (!ciWorkflow.includes("pnpm cloudflare:build"))
  failures.push("GitHub CI must execute the OpenNext Cloudflare build");
if (!ciWorkflow.includes("pnpm verify:cloudflare:build"))
  failures.push("GitHub CI must verify generated static pages and Worker artifacts");

const requiredCiCommands = [
  "pnpm install --frozen-lockfile",
  "node scripts/verify-install.mjs",
  "pnpm audit",
  "pnpm format:check:changed",
  "pnpm foundation:check",
  "pnpm frontend:data:check",
  "pnpm architecture:check",
  "pnpm lint",
  "pnpm typecheck",
  "pnpm test",
  "pnpm db:prepare:e2e",
  "pnpm --filter @ecommerce/web exec playwright install --with-deps chromium",
  "pnpm test:e2e",
  "pnpm cloudflare:build",
  "pnpm verify:cloudflare:build",
];
for (const command of requiredCiCommands) {
  if (!ciWorkflow.includes(command)) {
    failures.push(`GitHub CI is missing required quality command: ${command}`);
  }
}

if (!/^  pull_request:\r?\n    branches:\r?\n      - main/m.test(ciWorkflow)) {
  failures.push("GitHub CI must run for pull requests targeting main");
}
if (!/^  push:\r?\n    branches:\r?\n      - main/m.test(ciWorkflow)) {
  failures.push("GitHub CI must run for pushes to main");
}

const auditStepStart = ciWorkflow.indexOf("      - name: Audit all dependencies");
const auditStepEnd = ciWorkflow.indexOf("\n      - name:", auditStepStart + 1);
const auditStep =
  auditStepStart >= 0
    ? ciWorkflow.slice(auditStepStart, auditStepEnd >= 0 ? auditStepEnd : undefined)
    : "";

if (!auditStep.includes("run: pnpm audit")) {
  failures.push("GitHub CI must execute the complete pnpm audit");
}
if (auditStep.includes("continue-on-error")) {
  failures.push("Dependency audit failures must not be ignored");
}

const requiredCheckJob = ciWorkflow.slice(ciWorkflow.indexOf("  ci-required:"));
for (const requiredFragment of [
  "    name: CI required",
  "    if: ${{ always() }}",
  "      - runner-diagnostics",
  "      - payment-quality",
  "needs.runner-diagnostics.result",
  "needs.payment-quality.result",
  '!= "success"',
]) {
  if (!requiredCheckJob.includes(requiredFragment)) {
    failures.push(`The required CI aggregate job is missing: ${requiredFragment}`);
  }
}

const playwrightConfig = await readFile("apps/web/playwright.config.ts", "utf8");
if (
  !playwrightConfig.includes("process.env.CI") ||
  !playwrightConfig.includes("pnpm exec wrangler dev --config wrangler.jsonc --local") ||
  !playwrightConfig.includes("pnpm preview:cloudflare")
) {
  failures.push(
    "CI Playwright must reuse the prebuilt OpenNext output instead of triggering another build",
  );
}

const buildStepIndex = ciWorkflow.indexOf("      - name: Build Cloudflare Worker with OpenNext");
const artifactStepIndex = ciWorkflow.indexOf(
  "      - name: Verify generated static pages and Worker bundle",
);
const e2eStepIndex = ciWorkflow.indexOf(
  "      - name: Run end-to-end tests against local Wrangler",
);
if (
  buildStepIndex < 0 ||
  artifactStepIndex < 0 ||
  e2eStepIndex < 0 ||
  buildStepIndex > e2eStepIndex ||
  artifactStepIndex > e2eStepIndex
) {
  failures.push(
    "GitHub CI must build and verify OpenNext once before E2E reuses the local Worker artifact",
  );
}

const productionVerificationHasRemoteD1 = productionVerification.includes(
  "pnpm db:verify:production",
);
if (productionVerificationHasRemoteD1)
  failures.push("scheduled GitHub verification must not require remote D1 API credentials");

const adminRoute = await readFile("apps/web/app/api/admin/resources/route.ts", "utf8");
if (/\.prepare\s*\(/.test(adminRoute))
  failures.push("admin presentation route must not execute SQL directly");
if (/modules\/[^\"']+\/infrastructure/.test(adminRoute))
  failures.push("admin presentation route must not import infrastructure directly");

if (failures.length) {
  console.error("Foundation invariant check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation invariant check passed.");
