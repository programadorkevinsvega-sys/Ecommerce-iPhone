const PRODUCTION_MONITOR_AUDIENCE = "ecommerce-iphone-production-monitor";

export async function getProductionMonitorHeaders(targetUrl) {
  const target = new URL(targetUrl);
  const labels = target.hostname.toLowerCase().split(".");
  const isRestrictedMonitorHost =
    labels.length === 4 &&
    labels[0] === "ecommerce-iphone" &&
    /^[a-z0-9-]{1,63}$/.test(labels[1] ?? "") &&
    labels[2] === "workers" &&
    labels[3] === "dev";
  if (!isRestrictedMonitorHost) {
    if (target.hostname.toLowerCase().endsWith(".workers.dev")) {
      throw new Error(
        "Refusing to send a GitHub OIDC token to an unrecognized workers.dev hostname.",
      );
    }
    return {};
  }

  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    throw new Error(
      "A GitHub Actions OIDC token is required for the protected workers.dev production monitor.",
    );
  }

  const tokenUrl = new URL(requestUrl);
  tokenUrl.searchParams.set("audience", PRODUCTION_MONITOR_AUDIENCE);
  const response = await fetch(tokenUrl, {
    headers: { authorization: `Bearer ${requestToken}`, accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub OIDC token request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.value !== "string" || payload.value.length === 0) {
    throw new Error("GitHub OIDC did not return a usable production monitor token.");
  }

  return { authorization: `Bearer ${payload.value}` };
}
