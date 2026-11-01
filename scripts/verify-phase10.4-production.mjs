const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.PHASE10_4_TIMEOUT_MS ?? "15000");
const pollIntervalMs = Number(process.env.PHASE10_4_POLL_INTERVAL_MS ?? "5000");
const pollAttempts = Number(process.env.PHASE10_4_POLL_ATTEMPTS ?? "36");

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
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function parsePayload(row, label) {
  assert(typeof row?.payload_json === "string", `${label}: payload_json is missing`);
  try {
    return JSON.parse(row.payload_json);
  } catch {
    throw new Error(`${label}: payload_json is invalid JSON`);
  }
}

async function verifyRealServerCheckoutEvents() {
  const rows = await d1(
    `SELECT
       ae.event_id AS eventId,
       ae.event_type AS eventType,
       ae.source AS source,
       ae.payload_json AS payloadJson,
       o.id AS persistedOrderId,
       o.status AS orderStatus,
       o.shipping_method AS shippingMethod,
       o.discount_in_cents AS discountInCents,
       o.total_in_cents AS orderTotalInCents,
       o.currency AS orderCurrency,
       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id) AS orderItemCount,
       p.id AS persistedPaymentId,
       p.order_id AS paymentOrderId,
       p.provider AS paymentProvider,
       p.status AS paymentStatus,
       p.amount_in_cents AS paymentAmountInCents,
       p.currency AS paymentCurrency
     FROM analytics_events ae
     LEFT JOIN orders o ON o.id=json_extract(ae.payload_json,'$.orderId')
     LEFT JOIN payments p ON p.id=json_extract(ae.payload_json,'$.paymentId')
     WHERE ae.source='server'
       AND ae.event_type IN ('CheckoutStarted','ShippingMethodSelected','PaymentStarted','PurchaseCompleted')
     ORDER BY ae.occurred_at DESC
     LIMIT 1000`,
  );

  const counts = new Map([
    ["CheckoutStarted", 0],
    ["ShippingMethodSelected", 0],
    ["PaymentStarted", 0],
    ["PurchaseCompleted", 0],
  ]);
  const allowedPaidOrderStates = [
    "PAID",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPED",
    "DELIVERED",
    "REFUND_PENDING",
    "REFUNDED",
  ];

  for (const row of rows) {
    equal(row.source, "server", "checkout funnel event source");
    const payload = parsePayload({ payload_json: row.payloadJson }, row.eventType);
    assert(row.persistedOrderId, `${row.eventType} references an order that does not exist`);
    equal(payload.orderId, row.persistedOrderId, `${row.eventType} order reference`);
    assert(
      !/(email|phone|address|recipient|shippingAddress|token|secret|authorization)/i.test(
        row.payloadJson,
      ),
      `${row.eventType} payload contains sensitive data`,
    );

    if (row.eventType === "CheckoutStarted") {
      equal(row.eventId, `checkout-started:${row.persistedOrderId}`, "CheckoutStarted event ID");
      equal(
        payload.shippingMethod,
        row.shippingMethod,
        "CheckoutStarted persisted shipping method",
      );
      equal(
        Number(payload.itemCount),
        Number(row.orderItemCount),
        "CheckoutStarted persisted item count",
      );
      equal(
        Boolean(payload.hasDiscount),
        Number(row.discountInCents) > 0,
        "CheckoutStarted persisted discount flag",
      );
    } else if (row.eventType === "ShippingMethodSelected") {
      equal(
        row.eventId,
        `shipping-method-selected:${row.persistedOrderId}`,
        "ShippingMethodSelected event ID",
      );
      equal(
        payload.shippingMethodId,
        row.shippingMethod,
        "ShippingMethodSelected canonical method",
      );
    } else {
      assert(row.persistedPaymentId, `${row.eventType} references a payment that does not exist`);
      equal(payload.paymentId, row.persistedPaymentId, `${row.eventType} payment reference`);
      equal(row.paymentOrderId, row.persistedOrderId, `${row.eventType} payment/order relation`);
      equal(payload.provider, row.paymentProvider, `${row.eventType} payment provider`);
      equal(
        Number(payload.amountInCents),
        Number(row.paymentAmountInCents),
        `${row.eventType} payment amount`,
      );
      equal(payload.currency, row.paymentCurrency, `${row.eventType} payment currency`);
      equal(row.paymentCurrency, row.orderCurrency, `${row.eventType} order/payment currency`);
      equal(
        Number(row.paymentAmountInCents),
        Number(row.orderTotalInCents),
        `${row.eventType} order/payment amount`,
      );
      if (row.eventType === "PaymentStarted") {
        equal(row.eventId, `payment-started:${row.persistedPaymentId}`, "PaymentStarted event ID");
      } else {
        equal(
          row.eventId,
          `purchase-completed:${row.persistedPaymentId}`,
          "PurchaseCompleted event ID",
        );
        assert(
          ["PAID", "REFUNDED"].includes(row.paymentStatus),
          "PurchaseCompleted payment is not confirmed",
        );
        assert(
          allowedPaidOrderStates.includes(row.orderStatus),
          "PurchaseCompleted order is not in a paid lifecycle state",
        );
        assert(
          typeof payload.transactionId === "string" && payload.transactionId.length > 0,
          "PurchaseCompleted provider transaction reference is missing",
        );
      }
    }
    counts.set(row.eventType, (counts.get(row.eventType) ?? 0) + 1);
  }

  for (const eventType of counts.keys()) {
    const count = counts.get(eventType) ?? 0;
    if (count === 0)
      throw new Error(
        "INCONCLUSIVE: no real server-owned " +
          eventType +
          " events are available for production certification",
      );
    console.log(
      "PASS " +
        eventType +
        ": " +
        count +
        " persisted server-owned events linked to canonical order/payment records",
    );
  }
}
const probe = crypto.randomUUID();
const cartId = `phase10-4-cart-${probe}`;
const abandonedCartId = `phase10-4-abandoned-cart-${probe}`;
const visitorId = `phase10-4-visitor-${probe}`;
const sessionId = `phase10-4-session-${probe}`;
const requestId = `phase10-4-request-${probe}`;
const addIdempotencyKey = `phase10-4-add-${probe}`;
const removeIdempotencyKey = `phase10-4-remove-${probe}`;

let cartEventsCompleted = false;
let abandonedCartCompleted = false;

try {
  const preferredProductRows = await d1(
    "SELECT id,slug,stock,price_in_cents,currency FROM products WHERE slug='iphone-17-pro-max' AND active=1 AND stock>0 LIMIT 1",
  );
  const productRows =
    preferredProductRows.length > 0
      ? preferredProductRows
      : await d1(
          "SELECT id,slug,stock,price_in_cents,currency FROM products WHERE active=1 AND stock>0 ORDER BY updated_at DESC LIMIT 1",
        );

  assert(
    productRows.length === 1,
    "no active production product with stock available for real cart verification",
  );
  const product = productRows[0];
  const productId = product.id;
  console.log(
    `PASS real verification product: ${product.slug} with stock ${Number(product.stock)}${preferredProductRows.length === 0 ? " (fallback because iphone-17-pro-max has no stock)" : ""}`,
  );

  const cartCookie = `cart_id=${cartId}`;
  const analyticsCookie = `__Host-analytics-visitor=${visitorId}; __Host-analytics-session=${sessionId}`;
  const commonHeaders = {
    "content-type": "application/json",
    cookie: `${cartCookie}; ${analyticsCookie}`,
    "x-request-id": requestId,
  };

  const addRequest = () =>
    request("/api/cart", {
      method: "POST",
      headers: { ...commonHeaders, "Idempotency-Key": addIdempotencyKey },
      body: JSON.stringify({ productId, quantity: 1 }),
    });

  const addResponse = await addRequest();
  assert(addResponse.status === 200, `real cart add: expected HTTP 200, got ${addResponse.status}`);
  console.log("PASS real cart add: HTTP 200");

  const repeatedAddResponse = await addRequest();
  assert(
    repeatedAddResponse.status === 200,
    `idempotent add retry: expected HTTP 200, got ${repeatedAddResponse.status}`,
  );
  console.log("PASS real cart add and idempotent retry: HTTP 200");
  const removeRequest = () =>
    request("/api/cart", {
      method: "DELETE",
      headers: { ...commonHeaders, "Idempotency-Key": removeIdempotencyKey },
      body: JSON.stringify({ productId }),
    });

  const removeResponse = await removeRequest();
  assert(
    removeResponse.status === 200,
    `real cart remove: expected HTTP 200, got ${removeResponse.status}`,
  );
  const repeatedRemoveResponse = await removeRequest();
  assert(
    repeatedRemoveResponse.status === 200,
    `idempotent cart remove retry: expected HTTP 200, got ${repeatedRemoveResponse.status}`,
  );
  console.log("PASS real cart remove and no-op retry: HTTP 200");

  const checkoutResponse = await request("/checkout");
  assert(
    checkoutResponse.status === 200,
    `checkout route: expected HTTP 200, got ${checkoutResponse.status}`,
  );
  console.log("PASS real checkout route: HTTP 200");

  const unauthenticatedPaymentResponse = await request("/api/payments/intent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      "Idempotency-Key": `phase10-4-payment-${probe}`,
    },
    body: JSON.stringify({
      orderId: "phase10-4-not-a-real-order",
      paymentProvider: "WOMPI",
    }),
  });
  assert(
    unauthenticatedPaymentResponse.status === 401,
    `payment intent authorization guard: expected HTTP 401, got ${unauthenticatedPaymentResponse.status}`,
  );
  console.log("PASS payment intent authorization guard: HTTP 401");

  let cartEventRows = [];
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    cartEventRows = await d1(
      `SELECT event_id,event_type,event_version,session_id,visitor_id,request_id,source,payload_json
       FROM analytics_events
       WHERE session_id=${sqlString(sessionId)}
         AND event_type IN ('CartItemAdded','CartItemRemoved')
       ORDER BY occurred_at ASC`,
    );
    const addedCount = cartEventRows.filter((row) => row.event_type === "CartItemAdded").length;
    const removedCount = cartEventRows.filter((row) => row.event_type === "CartItemRemoved").length;
    if (addedCount > 1 || removedCount > 1) {
      throw new Error(
        `Cart analytics idempotency failed: added=${addedCount}, removed=${removedCount}`,
      );
    }
    if (addedCount === 1 && removedCount === 1) break;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  const addedRows = cartEventRows.filter((row) => row.event_type === "CartItemAdded");
  const removedRows = cartEventRows.filter((row) => row.event_type === "CartItemRemoved");
  assert(
    addedRows.length === 1,
    `CartItemAdded: expected one persisted event, got ${addedRows.length}`,
  );
  assert(
    removedRows.length === 1,
    `CartItemRemoved: expected one persisted event, got ${removedRows.length}`,
  );

  for (const row of [...addedRows, ...removedRows]) {
    assert(row.event_version === 1, "cart analytics event version mismatch");
    assert(row.visitor_id === visitorId, "cart analytics visitor mismatch");
    assert(row.source === "server", "cart analytics source mismatch");
    assert(row.request_id === requestId, "cart analytics request correlation mismatch");
    assert(
      parsePayload(row, row.event_type).productId === productId,
      `${row.event_type} does not reference the real product`,
    );
  }
  assert(
    addedRows[0].event_id.startsWith("cart-added:"),
    "CartItemAdded must use its deterministic operation key",
  );
  assert(
    removedRows[0].event_id.startsWith("cart-removed:"),
    "CartItemRemoved must use its deterministic operation key",
  );
  cartEventsCompleted = true;
  console.log(
    "PASS HTTP → EVENTS_QUEUE → D1: one CartItemAdded and one CartItemRemoved; no-op DELETE did not emit a duplicate",
  );

  await d1(
    `INSERT INTO carts(id,customer_id,currency,updated_at)
     VALUES(${sqlString(abandonedCartId)},NULL,${sqlString(product.currency)},datetime('now','-3650 days'))`,
  );
  const abandonedCartTimestamp = await d1(
    `SELECT updated_at FROM carts WHERE id=${sqlString(abandonedCartId)} LIMIT 1`,
  );
  assert(abandonedCartTimestamp.length === 1, "abandoned cart probe creation failed");
  const lastActivityAt = abandonedCartTimestamp[0].updated_at;
  const abandonedEventId = `cart-abandoned:${abandonedCartId}:${lastActivityAt.replace(" ", "T").replaceAll(":", "-")}`;

  await d1(
    `INSERT INTO cart_items(id,cart_id,product_id,quantity,unit_price_in_cents,variant_id)
     VALUES(${sqlString(crypto.randomUUID())},${sqlString(abandonedCartId)},${sqlString(productId)},1,${Number(product.price_in_cents)},NULL)`,
  );
  const insertedItemRows = await d1(
    `SELECT COUNT(*) AS count FROM cart_items WHERE cart_id=${sqlString(abandonedCartId)} AND product_id=${sqlString(productId)}`,
  );
  assert(
    Number(insertedItemRows[0]?.count ?? 0) === 1,
    "abandoned cart probe item was not persisted",
  );

  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const rows = await d1(
      `SELECT event_id,event_type,event_version,occurred_at,session_id,visitor_id,source,payload_json
       FROM analytics_events
       WHERE event_id=${sqlString(abandonedEventId)}
       LIMIT 1`,
    );

    if (rows.length === 1) {
      const row = rows[0];
      const payload = parsePayload(row, "CartAbandoned");
      assert(row.event_type === "CartAbandoned", "abandoned cart event type mismatch");
      assert(row.event_version === 1, "abandoned cart event version mismatch");
      assert(row.source === "server", "abandoned cart event must be server-owned");
      assert(row.session_id === `cart:${abandonedCartId}`, "abandoned cart session mismatch");
      assert(payload.cartId === abandonedCartId, "abandoned cart payload ID mismatch");
      assert(Number(payload.itemCount) === 1, "abandoned cart payload item count mismatch");
      assert(Number(payload.abandonmentMinutes) >= 30, "abandoned cart threshold was not met");
      abandonedCartCompleted = true;
      console.log(`PASS CartAbandoned scheduled-worker event after ${attempt} poll(s)`);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  assert(
    abandonedCartCompleted,
    `CartAbandoned scheduled-worker event not persisted after ${pollAttempts} polls; verify the existing Cloudflare Cron Trigger`,
  );

  await verifyRealServerCheckoutEvents();

  const unauthenticatedRevenueResponse = await request("/api/admin/analytics/revenue");
  assert(
    unauthenticatedRevenueResponse.status === 401,
    `admin revenue authorization guard: expected HTTP 401, got ${unauthenticatedRevenueResponse.status}`,
  );
  assert(
    unauthenticatedRevenueResponse.headers.get("cache-control")?.toLowerCase() === "no-store",
    "admin revenue endpoint must return Cache-Control: no-store",
  );
  console.log("PASS admin revenue authorization and no-store policy");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("INCONCLUSIVE:")) {
    console.warn(`INCONCLUSIVE Phase 10.4 production verification: ${message}`);
    process.exitCode = 2;
  } else {
    console.error(`FAIL Phase 10.4 production verification: ${message}`);
    process.exitCode = 1;
  }
} finally {
  try {
    await d1(
      `DELETE FROM analytics_events
       WHERE session_id IN (${sqlString(sessionId)},${sqlString(`cart:${abandonedCartId}`)})
          OR instr(event_id,${sqlString(`cart-abandoned:${abandonedCartId}:`)})=1`,
    );
    await d1(
      `DELETE FROM cart_items WHERE cart_id IN (${sqlString(cartId)},${sqlString(abandonedCartId)})`,
    );
    await d1(`DELETE FROM carts WHERE id IN (${sqlString(cartId)},${sqlString(abandonedCartId)})`);
    console.log("PASS production verification cleanup: both isolated cart probes removed from D1");
  } catch (error) {
    console.error(
      `FAIL production verification cleanup: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.exitCode === undefined && cartEventsCompleted && abandonedCartCompleted) {
  console.log(`Phase 10.4 production verification passed for ${BASE_URL}`);
} else if (process.exitCode !== 2) {
  process.exitCode = 1;
}
