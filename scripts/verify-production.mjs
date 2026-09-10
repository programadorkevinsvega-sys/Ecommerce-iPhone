const BASE_URL = (process.env.PRODUCTION_URL ?? "https://ecommerce-iphone.programadorkevinsvega.workers.dev").replace(/\/$/, "");
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? "15000");
const retries = Number(process.env.HEALTH_RETRIES ?? "30");
const retryDelayMs = Number(process.env.HEALTH_RETRY_DELAY_MS ?? "10000");

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

async function getJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function assertHealth(path, expectedStatus, expectedBodyStatus) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await request(path);
      const body = await getJson(response);
      const requestId = response.headers.get("x-request-id");
      if (response.status === expectedStatus && body.status === expectedBodyStatus && requestId) {
        console.log(`PASS ${path}: HTTP ${response.status}, status=${body.status}, request_id=${requestId}`);
        return;
      }
      lastError = new Error(`${path}: expected HTTP ${expectedStatus}/${expectedBodyStatus}, got HTTP ${response.status}/${body.status ?? "missing"}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await sleep(retryDelayMs);
  }
  throw lastError ?? new Error(`Health verification failed for ${path}`);
}

async function verifyRateLimit() {
  const path = "/api/checkout?foundation_probe=1";
  let observed429 = false;
  let count = 0;

  for (let i = 1; i <= 21; i += 1) {
    const response = await request(path);
    count += 1;
    if (response.status === 429) {
      observed429 = true;
      const retryAfter = response.headers.get("retry-after");
      const requestId = response.headers.get("x-request-id");
      if (!requestId || !retryAfter) {
        throw new Error(`Rate limit returned 429 without required headers: requestId=${requestId}, retryAfter=${retryAfter}`);
      }
      console.log(`PASS rate limit: HTTP 429 observed at request ${i}, Retry-After=${retryAfter}`);
      break;
    }
  }

  if (!observed429) {
    throw new Error(`Rate limit verification failed: no HTTP 429 after ${count} requests`);
  }
}

await assertHealth("/api/health/live", 200, "ok");
await assertHealth("/api/health/ready", 200, "ready");
await verifyRateLimit();
console.log(`Production verification passed for ${BASE_URL}`);
