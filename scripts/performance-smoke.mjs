import { createRequire } from "node:module";
import { join } from "node:path";
import { isCloudflareEdgeBlock } from "./cloudflare-edge-response.mjs";

const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");

const baseUrl = (process.env.PERF_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("PERF_BASE_URL is required");
  process.exit(1);
}

const routes = ["/", "/catalog", "/iphone/iphone-17-pro-max", "/cart", "/checkout", "/contacto"];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const route of routes) {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const metrics = { lcpMs: null, cls: 0, interactionP98Ms: null };
      const interactions = new Map();
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const latest = entries[entries.length - 1];
          if (latest) metrics.lcpMs = Math.round(latest.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) metrics.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.interactionId || entry.interactionId <= 0) continue;
            interactions.set(
              entry.interactionId,
              Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration),
            );
          }
          const values = [...interactions.values()].sort((a, b) => a - b);
          if (values.length > 0) {
            const index = Math.min(values.length - 1, Math.ceil(values.length * 0.98) - 1);
            metrics.interactionP98Ms = Math.round(values[index]);
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {}
      window.__productionHardeningVitals = metrics;
    });
    const started = Date.now();
    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const domContentLoadedMs = Date.now() - started;
    await page.waitForLoadState("load").catch(() => undefined);
    await page.keyboard.press("Tab").catch(() => undefined);
    await page.waitForTimeout(1000);
    const status = response?.status() ?? 0;
    const headers = response ? await response.allHeaders() : {};
    const bodyText = status === 403 && response ? (await response.text()).slice(0, 1200) : "";
    const edgeBlocked = isCloudflareEdgeBlock({ status, headers }, bodyText);
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
        lcpMs: window.__productionHardeningVitals?.lcpMs ?? null,
        interactionP98Ms: window.__productionHardeningVitals?.interactionP98Ms ?? null,
        cls: Number((window.__productionHardeningVitals?.cls ?? 0).toFixed(4)),
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
const limits = {
  ttfbMs: 800,
  domContentLoadedMs: 2500,
  loadEventMs: 4000,
  lcpMs: 2500,
  cls: 0.1,
  interactionP98Ms: 200,
};
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
