const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const configuredSubdomain = process.env.CLOUDFLARE_WORKERS_DEV_SUBDOMAIN?.trim();
const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? "ecommerce-iphone";

if (workerName !== "ecommerce-iphone") {
  throw new Error("The production monitor worker name must be ecommerce-iphone.");
}

function isValidSubdomain(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);
}

let subdomain = configuredSubdomain;
if (subdomain && !isValidSubdomain(subdomain)) {
  throw new Error(
    "CLOUDFLARE_WORKERS_DEV_SUBDOMAIN must be the account workers.dev subdomain only (without protocol or hostname).",
  );
}

if (!subdomain) {
  if (!accountId || !apiToken) {
    throw new Error(
      "Set the GitHub Actions variable CLOUDFLARE_WORKERS_DEV_SUBDOMAIN or provide CLOUDFLARE_ACCOUNT_ID and a CLOUDFLARE_API_TOKEN with Workers Scripts Read permission.",
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/subdomain`,
    {
      headers: {
        authorization: `Bearer ${apiToken}`,
        accept: "application/json",
      },
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true || !isValidSubdomain(payload?.result?.subdomain)) {
    throw new Error(
      `Unable to resolve the Cloudflare Workers subdomain (HTTP ${response.status}). Set the GitHub Actions variable CLOUDFLARE_WORKERS_DEV_SUBDOMAIN or ensure the API token has Workers Scripts Read permission and the account has a workers.dev subdomain configured.`,
    );
  }
  subdomain = payload.result.subdomain;
}

const monitorUrl = `https://${workerName}.${subdomain}.workers.dev`;
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_OUTPUT, `monitor_url=${monitorUrl}\n`);
}
console.log(`Resolved the protected production monitor host: ${new URL(monitorUrl).hostname}`);
