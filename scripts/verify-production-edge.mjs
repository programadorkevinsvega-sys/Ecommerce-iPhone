import { isCloudflareEdgeBlock } from "./cloudflare-edge-response.mjs";

const baseUrl = (process.env.PUBLIC_PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(
  /\/$/,
  "",
);
const response = await fetch(`${baseUrl}/api/health/live`, {
  headers: { accept: "application/json" },
  redirect: "manual",
});
const body = await response.text();

function writeOutput(value) {
  if (process.env.GITHUB_OUTPUT) {
    return import("node:fs/promises").then(({ appendFile }) =>
      appendFile(process.env.GITHUB_OUTPUT, `public_edge_verified=${value}\n`),
    );
  }
  return Promise.resolve();
}

function writeSummary(text) {
  if (!process.env.GITHUB_STEP_SUMMARY) return Promise.resolve();
  return import("node:fs/promises").then(({ appendFile }) =>
    appendFile(process.env.GITHUB_STEP_SUMMARY, text),
  );
}

if (isCloudflareEdgeBlock(response, body)) {
  await writeOutput("false");
  await writeSummary(
    "### Public edge monitor inconclusive\n\nCloudflare challenged the unauthenticated public-edge probe. The authenticated Worker runtime checks continue independently through the restricted workers.dev monitor host. This does not certify public-edge reachability.\n",
  );
  console.warn(
    `PUBLIC_EDGE_INCONCLUSIVE: Cloudflare challenged the public health probe (Ray ID: ${response.headers.get("cf-ray") ?? "unavailable"}).`,
  );
} else {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const requestId = response.headers.get("x-request-id");
  if (response.status !== 200 || parsed?.status !== "ok" || !requestId) {
    throw new Error(
      `Public edge health probe expected HTTP 200/status=ok with x-request-id; got HTTP ${response.status}, status=${parsed?.status ?? "unknown"}.`,
    );
  }

  await writeOutput("true");
  await writeSummary(
    "### Public edge monitor\n\nThe unauthenticated public health endpoint returned HTTP 200 with a Worker request ID.\n",
  );
  console.log(`PASS public edge: HTTP 200, request_id=${requestId}`);
}
