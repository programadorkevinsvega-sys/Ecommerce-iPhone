import { defineConfig, devices } from "@playwright/test";

const webServerCommand = process.env.CI
  ? "cd ../.. && pnpm exec wrangler dev --config wrangler.jsonc --local --var E2E_DISABLE_NOTIFICATION_DELIVERY:true"
  : "pnpm preview:cloudflare";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: { baseURL: "http://localhost:8787", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: webServerCommand,
    url: "http://localhost:8787",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
