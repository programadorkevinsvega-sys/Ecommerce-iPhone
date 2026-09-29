import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");

const baseUrl = (process.env.PERF_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("PERF_BASE_URL is required");
  process.exit(1);
}

const routes = ["/", "/catalog", "/iphone/iphone-17-pro-max", "/cart", "/contacto"];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const route of routes) {
    const page = await browser.newPage();
    const started = Date.now();
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const domContentLoadedMs = Date.now() - started;
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
    results.push({ route, status: response?.status() ?? 0, domContentLoadedMs, ...metrics });
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
if (results.some((r) => r.status < 200 || r.status >= 400)) failures.push("A route returned a non-success HTTP status");
console.log(JSON.stringify({ baseUrl, limits, results, failures }, null, 2));
if (failures.length) {
  console.error("Performance smoke failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Performance smoke passed.");
