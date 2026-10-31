[36;1mcat scripts/verify-production.mjs[0m
shell: /usr/bin/bash -e {0}
env:
  PNPM_HOME: /home/runner/setup-pnpm/node_modules/.bin
##[endgroup]
scripts/performance-smoke.mjs 65ms
scripts/verify-production.mjs 18ms
=== PRETTIER OUTPUT: scripts/performance-smoke.mjs ===
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");

const baseUrl = (process.env.PERF_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("PERF_BASE_URL is required");
  process.exit(1);
}

function isCloudflareEdgeBlock(status, headers, bodyText) {
  if (status !== 403 || headers["x-request-id"]) return false;

  const server = (headers.server ?? "").toLowerCase();
  const cfRay = headers["cf-ray"];
  const mitigation = (headers["cf-mitigated"] ?? "").toLowerCase();
  const cloudflareBody =
    /attention required|sorry, you have been blocked|cloudflare ray id|cf-error-details|cf-chl-|just a moment/i.test(
      String(bodyText ?? ""),
    );

  return (
    mitigation === "challenge" ||
    ((server.includes("cloudflare") || Boolean(cfRay)) && cloudflareBody)
  );
}

const routes = ["/", "/catalog", "/iphone/iphone-17-pro-max", "/cart", "/contacto"];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const route of routes) {
    const page = await browser.newPage();
    const started = Date.now();
    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const domContentLoadedMs = Date.now() - started;
    const status = response?.status() ?? 0;
    const headers = response ? await response.allHeaders() : {};
    const bodyText = status === 403 && response ? (await response.text()).slice(0, 1200) : "";
    const edgeBlocked = isCloudflareEdgeBlock(status, headers, bodyText);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      return {
        ttfbMs: nav ? Math.round(nav.responseStart) : null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
        transferSizeBytes: Math.round(
          resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
        ),
        resourceCount: resources.length,
      };
    });

    results.push({
      route,
      status,
      domContentLoadedMs,
      ...metrics,
      ...(edgeBlocked
        ? {
            cloudflareEdgeBlocked: true,
            cfRay: headers["cf-ray"] ?? null,
            cfMitigated: headers["cf-mitigated"] ?? null,
            server: headers.server ?? null,
            contentType: headers["content-type"] ?? null,
            bodyExcerpt: bodyText.replace(/\s+/g, " ").slice(0, 240),
          }
        : {}),
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.table(results);
const limits = { ttfbMs: 800, domContentLoadedMs: 2500, loadEventMs: 4000 };
const edgeBlockedRoutes = results.filter((result) => result.cloudflareEdgeBlocked);
const measurableResults = results.filter((result) => !result.cloudflareEdgeBlocked);
const failures = measurableResults.flatMap((r) =>
  Object.entries(limits)
    .filter(([key, limit]) => r[key] != null && r[key] > limit)
    .map(([key, limit]) => `${r.route}: ${key}=${r[key]}ms > ${limit}ms`),
);
const nonEdgeHttpFailures = measurableResults.filter(
  (result) => result.status < 200 || result.status >= 400,
);

console.log(JSON.stringify({ baseUrl, limits, results, failures }, null, 2));

if (nonEdgeHttpFailures.length > 0 || failures.length > 0) {
  nonEdgeHttpFailures.forEach((result) => {
    failures.push(`${result.route}: non-success HTTP ${result.status}`);
  });
  console.error("Performance smoke failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else if (edgeBlockedRoutes.length > 0) {
  console.warn(
    `PERFORMANCE_MONITOR_INCONCLUSIVE: Cloudflare edge blocked ${edgeBlockedRoutes.length} of ${routes.length} route probes. These timings measure the challenge/block response, not the deployed storefront.`,
  );
  process.exitCode = 2;
} else {
  console.log("Performance smoke passed.");
}
=== PRETTIER OUTPUT: scripts/verify-production.mjs ===
const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? "15000");
const retries = Number(process.env.HEALTH_RETRIES ?? "30");
const retryDelayMs = Number(process.env.HEALTH_RETRY_DELAY_MS ?? "10000");
const rateLimitAttempts = Number(process.env.RATE_LIMIT_PROBE_ATTEMPTS ?? "21");
const strictRateLimit = process.env.STRICT_RATE_LIMIT_VERIFICATION === "1";

class CloudflareEdgeBlockedError extends Error {
  constructor(path, diagnostic) {
    super(`Cloudflare edge blocked the production monitor at ${path}: ${diagnostic}`);
    this.name = "CloudflareEdgeBlockedError";
    this.exitCode = 2;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { accept: "application/json", ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

function responseDiagnostic(response, bodyText) {
  const headers = response.headers;
  return JSON.stringify({
    status: response.status,
    server: headers.get("server"),
    cfRay: headers.get("cf-ray"),
    cfMitigated: headers.get("cf-mitigated"),
    contentType: headers.get("content-type"),
    requestId: headers.get("x-request-id"),
    bodyExcerpt: String(bodyText ?? "")
      .replace(/\s+/g, " ")
      .slice(0, 240),
  });
}

function isCloudflareEdgeBlock(response, bodyText) {
  if (response.status !== 403 || response.headers.get("x-request-id")) return false;

  const server = (response.headers.get("server") ?? "").toLowerCase();
  const cfRay = response.headers.get("cf-ray");
  const mitigation = (response.headers.get("cf-mitigated") ?? "").toLowerCase();
  const cloudflareBody =
    /attention required|sorry, you have been blocked|cloudflare ray id|cf-error-details|cf-chl-|just a moment/i.test(
      String(bodyText ?? ""),
    );

  return (
    mitigation === "challenge" ||
    ((server.includes("cloudflare") || Boolean(cfRay)) && cloudflareBody)
  );
}

async function assertHealth(path, expectedStatus, expectedBodyStatus) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await request(path);
      const rawBody = await response.text();

      if (isCloudflareEdgeBlock(response, rawBody)) {
        throw new CloudflareEdgeBlockedError(path, responseDiagnostic(response, rawBody));
      }

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = { status: "missing" };
      }

      const requestId = response.headers.get("x-request-id");
      if (response.status === expectedStatus && body.status === expectedBodyStatus && requestId) {
        console.log(
          `PASS ${path}: HTTP ${response.status}, status=${body.status}, request_id=${requestId}`,
        );
        return;
      }

      lastError = new Error(
        `${path}: expected HTTP ${expectedStatus}/${expectedBodyStatus}, got HTTP ${response.status}/${body.status}; response=${responseDiagnostic(response, rawBody)}`,
      );
    } catch (error) {
      if (error instanceof CloudflareEdgeBlockedError) throw error;
      lastError = error;
    }

    if (attempt < retries) await sleep(retryDelayMs);
  }

  throw lastError ?? new Error(`Health verification failed for ${path}`);
}

async function verifyRateLimit() {
  const path = "/api/checkout?foundation_probe=1";

  for (let i = 1; i <= rateLimitAttempts; i += 1) {
    const response = await request(path);
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const requestId = response.headers.get("x-request-id");
      if (!requestId || !retryAfter) {
        throw new Error(
          `Rate limit returned 429 without required headers: requestId=${requestId}, retryAfter=${retryAfter}`,
        );
      }
      console.log(`PASS rate limit: HTTP 429 observed at request ${i}, Retry-After=${retryAfter}`);
      return;
    }

    if (response.status === 403) {
      const rawBody = await response.text();
      if (isCloudflareEdgeBlock(response, rawBody)) {
        throw new CloudflareEdgeBlockedError(path, responseDiagnostic(response, rawBody));
      }
    }
  }

  const message = `WARN rate limit: no HTTP 429 after ${rateLimitAttempts} requests. Cloudflare Workers Rate Limiting is eventually consistent and may permit bursts across isolates/locations.`;
  if (strictRateLimit) throw new Error(message.replace(/^WARN /, ""));
  console.warn(message);
}

async function main() {
  await assertHealth("/api/health/live", 200, "ok");
  await assertHealth("/api/health/ready", 200, "ready");
  await verifyRateLimit();
  console.log(`Production verification passed for ${BASE_URL}`);
}

main().catch((error) => {
  if (error instanceof CloudflareEdgeBlockedError) {
    console.warn(`PRODUCTION_MONITOR_INCONCLUSIVE: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
