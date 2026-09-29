const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.PHASE10_4_TIMEOUT_MS ?? "15000");
const pollIntervalMs = Number(process.env.PHASE10_4_POLL_INTERVAL_MS ?? "3000");
const pollAttempts = Number(process.env.PHASE10_4_POLL_ATTEMPTS ?? "20");

const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
const execFileAsync = promisify(execFile);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      redirect: "manual",
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json,text/html",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function d1(sql) {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", "--remote", "--json", "--command", sql],
    { env: process.env, maxBuffer: 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout);
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return result?.results ?? [];
}

function sqlString(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

const probe = crypto.randomUUID();
const cartId = `phase10-4-cart-${probe}`;
const visitorId = `phase10-4-visitor-${probe}`;
const sessionId = `phase10-4-session-${probe}`;
const requestId = `phase10-4-request-${probe}`;

let completed = false;

try {
  const preferredProductRows = await d1(
    "SELECT id,slug,stock FROM products WHERE slug='iphone-17-pro-max' AND active=1 AND stock>0 LIMIT 1",
  );
  const productRows = preferredProductRows.length > 0
    ? preferredProductRows
    : await d1("SELECT id,slug,stock FROM products WHERE active=1 AND stock>0 ORDER BY updated_at DESC LIMIT 1");
  assert(productRows.length === 1, "no active production product with stock available for real cart verification");
  const productId = productRows[0].id;
  console.log(
    `PASS real verification product: ${productRows[0].slug} with stock ${Number(productRows[0].stock)}${preferredProductRows.length === 0 ? " (fallback because iphone-17-pro-max has no stock)" : ""}`,
  );

  const cartCookie = `cart_id=${cartId}`;
  const analyticsCookie = `__Host-analytics-visitor=${visitorId}; __Host-analytics-session=${sessionId}`;

  const addResponse = await request("/api/cart", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${cartCookie}; ${analyticsCookie}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  assert(addResponse.status === 200, `real cart add: expected HTTP 200, got ${addResponse.status}`);
  console.log("PASS real cart add: HTTP 200");

  const removeResponse = await request("/api/cart", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      cookie: `${cartCookie}; ${analyticsCookie}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify({ productId }),
  });
  assert(removeResponse.status === 200, `real cart remove: expected HTTP 200, got ${removeResponse.status}`);
  console.log("PASS real cart remove: HTTP 200");

  const checkoutResponse = await request("/checkout");
  assert(checkoutResponse.status === 200, `checkout route: expected HTTP 200, got ${checkoutResponse.status}`);
  console.log("PASS real checkout route: HTTP 200");

  const unauthenticatedPaymentResponse = await request("/api/payments/intent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ orderId: "phase10-4-not-a-real-order", paymentProvider: "WOMPI" }),
  });
  assert(
    unauthenticatedPaymentResponse.status === 401,
    `payment intent authorization guard: expected HTTP 401, got ${unauthenticatedPaymentResponse.status}`,
  );
  console.log("PASS payment intent authorization guard: HTTP 401");

  const lookup = `SELECT event_id,event_type,event_version,session_id,visitor_id,request_id,source,payload_json FROM analytics_events WHERE session_id=${sqlString(sessionId)} AND event_type IN ('CartItemAdded','CartItemRemoved') ORDER BY occurred_at ASC`;

  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const rows = await d1(lookup);
    const added = rows.find((row) => row.event_type === "CartItemAdded");
    const removed = rows.find((row) => row.event_type === "CartItemRemoved");
    if (added && removed) {
      assert(added.event_version === 1 && removed.event_version === 1, "cart analytics event version mismatch");
      assert(added.visitor_id === visitorId && removed.visitor_id === visitorId, "cart analytics visitor mismatch");
      assert(added.source === "web" && removed.source === "web", "cart analytics source mismatch");
      assert(typeof added.payload_json === "string" && added.payload_json.includes(productId), "CartItemAdded payload does not reference the real product");
      assert(typeof removed.payload_json === "string" && removed.payload_json.includes(productId), "CartItemRemoved payload does not reference the real product");
      console.log(`PASS HTTP → EVENTS_QUEUE → D1: cart events persisted after ${attempt} poll(s)`);
      completed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  assert(completed, `cart analytics queue persistence timeout after ${pollAttempts} polls`);

  const abandoned = await d1(
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type='CartAbandoned' AND source='server'",
  );
  assert(abandoned.length === 1, "CartAbandoned server event query failed");
  console.log("PASS CartAbandoned server event query");

  const purchases = await d1(
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type='PurchaseCompleted' AND source='server'",
  );
  console.log(`INFO PurchaseCompleted server events currently persisted: ${Number(purchases[0]?.count ?? 0)}`);
} finally {
  try {
    await d1(
      `DELETE FROM analytics_events WHERE session_id=${sqlString(sessionId)} OR event_id LIKE 'cart-abandoned:${cartId}:%'`,
    );
    await d1(`DELETE FROM cart_items WHERE cart_id=${sqlString(cartId)}`);
    await d1(`DELETE FROM carts WHERE id=${sqlString(cartId)}`);
    console.log("PASS production verification cleanup: cart probe removed from D1");
  } catch (error) {
    console.error(`WARN production verification cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    if (completed) throw error;
  }
}

console.log(`Phase 10.4 production verification passed for ${BASE_URL}`);
