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
  const cloudflareBody = /attention required|sorry, you have been blocked|cloudflare ray id|cf-error-details|cf-chl-|just a moment/i.test(
    String(bodyText ?? ""),
  );

  return mitigation === "challenge" || ((server.includes("cloudflare") || Boolean(cfRay)) && cloudflareBody);
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
    const bodyText =
      status === 403 && response
        ? (await response.text()).slice(0, 1200)
        : "";
    const edgeBlocked = isCloudflareEdgeBlock(status, headers, bodyText);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      return {
        ttfbMs: nav ? Math.round(nav.responseStart) : null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
        transferSizeBytes: Math.round(resources.reduce((sum, item) => sum + (item.transferSize || 0), 0)),
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
const failures = results.flatMap((r) =>
  Object.entries(limits)
    .filter(([key, limit]) => r[key] != null && r[key] > limit)
    .map(([key, limit]) => `${r.route}: ${key}=${r[key]}ms > ${limit}ms`),
);
const edgeBlockedRoutes = results.filter((result) => result.cloudflareEdgeBlocked);
const nonEdgeHttpFailures = results.filter(
  (result) => !result.cloudflareEdgeBlocked && (result.status < 200 || result.status >= 400),
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
