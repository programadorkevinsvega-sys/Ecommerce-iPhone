const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? "ecommerce-iphone";

if (!accountId || !apiToken) {
  throw new Error(
    "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN for Workers subdomain discovery.",
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
if (
  !response.ok ||
  payload?.success !== true ||
  typeof payload?.result?.subdomain !== "string" ||
  !/^[a-z0-9-]{1,63}$/i.test(payload.result.subdomain)
) {
  throw new Error(
    `Unable to resolve the Cloudflare Workers subdomain (HTTP ${response.status}). Ensure the API token has Workers Scripts Read permission and the account has a workers.dev subdomain configured.`,
  );
}

const monitorUrl = `https://${workerName}.${payload.result.subdomain}.workers.dev`;
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_OUTPUT, `monitor_url=${monitorUrl}\n`);
}
console.log(`Resolved the protected production monitor host: ${new URL(monitorUrl).hostname}`);
