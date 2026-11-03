const BASE_URL = (process.env.PRODUCTION_URL ?? "").replace(/\/$/, "");
const timeoutMs = Number(process.env.PHASE10_4_TIMEOUT_MS ?? "15000");

const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
const execFileAsync = promisify(execFile);
const { getProductionMonitorHeaders } = await import("./production-monitor-auth.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, label) {
  assert(actual === expected, label + ": expected " + String(expected) + ", got " + String(actual));
}

function assertReadOnlySelect(sql) {
  assert(/^\s*SELECT\b/i.test(sql), "Production certification permits SELECT statements only.");
  assert(
    !/;\s*\S/.test(sql),
    "Multiple SQL statements are not allowed in production certification.",
  );
}

function parsePayload(row, label) {
  assert(typeof row?.payloadJson === "string", label + ": payload_json is missing");
  try {
    return JSON.parse(row.payloadJson);
  } catch {
    throw new Error(label + ": payload_json is invalid JSON");
  }
}

function assertNoSensitivePayload(payloadJson, label) {
  assert(
    !/(?:email|phone|address|recipient|token|secret|authorization|cardnumber|cvv)/i.test(
      payloadJson,
    ),
    label + ": analytics payload contains a sensitive field",
  );
}

let monitorHeaders = {};

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(BASE_URL + path, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...monitorHeaders,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function d1(sql) {
  assertReadOnlySelect(sql);
  const { stdout } = await execFileAsync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", "--remote", "--json", "--command", sql],
    { env: process.env, maxBuffer: 2 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout);
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return result?.results ?? [];
}

function validateCartEvents(rows, counts) {
  const seenIds = new Set();
  for (const row of rows.filter((entry) =>
    ["CartItemAdded", "CartItemRemoved", "CartAbandoned"].includes(entry.eventType),
  )) {
    equal(row.source, "server", row.eventType + " source");
    equal(Number(row.eventVersion), 1, row.eventType + " event version");
    assert(!seenIds.has(row.eventId), "duplicate persisted event ID: " + row.eventId);
    seenIds.add(row.eventId);
    assert(Number.isFinite(Date.parse(row.occurredAt)), row.eventType + ": invalid occurred_at");
    assertNoSensitivePayload(row.payloadJson, row.eventType);
    const payload = parsePayload(row, row.eventType);

    if (row.eventType === "CartItemAdded" || row.eventType === "CartItemRemoved") {
      const prefix = row.eventType === "CartItemAdded" ? "cart-added:" : "cart-removed:";
      assert(
        new RegExp("^" + prefix + "[a-f0-9]{64}$").test(row.eventId),
        row.eventType + ": event ID is not a deterministic SHA-256 fingerprint",
      );
      assert(
        typeof payload.cartId === "string" && payload.cartId.length > 0,
        row.eventType + ": cartId is missing",
      );
      assert(
        typeof payload.productId === "string" && payload.productId.length > 0,
        row.eventType + ": productId is missing",
      );
      assert(
        typeof row.sessionId === "string" && row.sessionId.length > 0,
        row.eventType + ": session correlation is missing",
      );
      assert(
        typeof row.visitorId === "string" && row.visitorId.length > 0,
        row.eventType + ": visitor correlation is missing",
      );
      if (row.eventType === "CartItemAdded") {
        assert(
          Number.isSafeInteger(Number(payload.quantity)) && Number(payload.quantity) > 0,
          "CartItemAdded quantity is invalid",
        );
      }
    } else {
      assert(
        typeof payload.cartId === "string" && payload.cartId.length > 0,
        "CartAbandoned cartId is missing",
      );
      assert(
        row.eventId.startsWith("cart-abandoned:" + payload.cartId + ":"),
        "CartAbandoned event ID does not match its cart",
      );
      assert(
        typeof row.sessionId === "string" && row.sessionId === "cart:" + payload.cartId,
        "CartAbandoned session mismatch",
      );
      assert(row.visitorId === "cart:" + payload.cartId, "CartAbandoned visitor mismatch");
      assert(Number(payload.itemCount) > 0, "CartAbandoned must reference a cart with items");
      assert(
        Number(payload.abandonmentMinutes) >= 30,
        "CartAbandoned did not meet the 30-minute threshold",
      );
      const receivedAt = Date.parse(row.receivedAt);
      const occurredAt = Date.parse(row.occurredAt);
      assert(
        Number.isFinite(receivedAt) && receivedAt - occurredAt >= 30 * 60 * 1000,
        "CartAbandoned persistence timestamp does not prove 30 minutes of inactivity",
      );
    }

    counts.set(row.eventType, (counts.get(row.eventType) ?? 0) + 1);
  }
}

function validateCheckoutEvents(rows, counts) {
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
    equal(row.source, "server", row.eventType + " source");
    equal(Number(row.eventVersion), 1, row.eventType + " event version");
    assertNoSensitivePayload(row.payloadJson, row.eventType);
    const payload = parsePayload(row, row.eventType);
    assert(row.persistedOrderId, row.eventType + " references an order that does not exist");
    equal(payload.orderId, row.persistedOrderId, row.eventType + " order reference");

    if (row.eventType === "CheckoutStarted") {
      equal(row.eventId, "checkout-started:" + row.persistedOrderId, "CheckoutStarted event ID");
      equal(
        payload.shippingMethod,
        row.shippingMethod,
        "CheckoutStarted canonical shipping method",
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
        "shipping-method-selected:" + row.persistedOrderId,
        "ShippingMethodSelected event ID",
      );
      equal(
        payload.shippingMethodId,
        row.shippingMethod,
        "ShippingMethodSelected canonical method",
      );
      assert(
        ["PICKUP", "DELIVERY"].includes(String(payload.shippingMethodId)),
        "ShippingMethodSelected contains an unknown method",
      );
    } else {
      assert(row.persistedPaymentId, row.eventType + " references a payment that does not exist");
      equal(payload.paymentId, row.persistedPaymentId, row.eventType + " payment reference");
      equal(row.paymentOrderId, row.persistedOrderId, row.eventType + " payment/order relation");
      equal(payload.provider, row.paymentProvider, row.eventType + " payment provider");
      equal(
        Number(payload.amountInCents),
        Number(row.paymentAmountInCents),
        row.eventType + " payment amount",
      );
      equal(payload.currency, row.paymentCurrency, row.eventType + " payment currency");
      equal(row.paymentCurrency, row.orderCurrency, row.eventType + " order/payment currency");
      equal(
        Number(row.paymentAmountInCents),
        Number(row.orderTotalInCents),
        row.eventType + " order/payment amount",
      );

      if (row.eventType === "PaymentStarted") {
        equal(row.eventId, "payment-started:" + row.persistedPaymentId, "PaymentStarted event ID");
      } else {
        equal(
          row.eventId,
          "purchase-completed:" + row.persistedPaymentId,
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
}

try {
  assert(
    BASE_URL.length > 0,
    "PRODUCTION_URL must be the protected production workers.dev monitor URL.",
  );
  const monitor = new URL(BASE_URL);
  assert(
    monitor.hostname.toLowerCase().endsWith(".workers.dev"),
    "Production certification must use the protected workers.dev monitor, not the public WAF edge.",
  );
  monitorHeaders = await getProductionMonitorHeaders(BASE_URL);
  assert(
    typeof monitorHeaders.authorization === "string",
    "GitHub Actions OIDC authorization is required for production certification.",
  );

  const eventRows = await d1(
    [
      "SELECT event_id AS eventId,event_type AS eventType,event_version AS eventVersion,",
      "occurred_at AS occurredAt,received_at AS receivedAt,session_id AS sessionId,",
      "visitor_id AS visitorId,source,request_id AS requestId,payload_json AS payloadJson",
      "FROM analytics_events",
      "WHERE event_type IN ('CartItemAdded','CartItemRemoved','CartAbandoned','CheckoutStarted','ShippingMethodSelected','PaymentStarted','PurchaseCompleted')",
      "ORDER BY occurred_at DESC LIMIT 2000",
    ].join(" "),
  );

  const counts = new Map([
    ["CartItemAdded", 0],
    ["CartItemRemoved", 0],
    ["CartAbandoned", 0],
    ["CheckoutStarted", 0],
    ["ShippingMethodSelected", 0],
    ["PaymentStarted", 0],
    ["PurchaseCompleted", 0],
  ]);

  const persistedCheckoutRows = await d1(
    [
      "SELECT ae.event_id AS eventId,ae.event_type AS eventType,ae.event_version AS eventVersion,",
      "ae.source,ae.payload_json AS payloadJson,o.id AS persistedOrderId,o.status AS orderStatus,",
      "o.shipping_method AS shippingMethod,o.discount_in_cents AS discountInCents,",
      "o.total_in_cents AS orderTotalInCents,o.currency AS orderCurrency,",
      "(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id) AS orderItemCount,",
      "p.id AS persistedPaymentId,p.order_id AS paymentOrderId,p.provider AS paymentProvider,",
      "p.status AS paymentStatus,p.amount_in_cents AS paymentAmountInCents,p.currency AS paymentCurrency",
      "FROM analytics_events ae",
      "LEFT JOIN orders o ON o.id=json_extract(ae.payload_json,'$.orderId')",
      "LEFT JOIN payments p ON p.id=json_extract(ae.payload_json,'$.paymentId')",
      "WHERE ae.event_type IN ('CheckoutStarted','ShippingMethodSelected','PaymentStarted','PurchaseCompleted')",
      "ORDER BY ae.occurred_at DESC LIMIT 2000",
    ].join(" "),
  );

  validateCartEvents(eventRows, counts);
  validateCheckoutEvents(persistedCheckoutRows, counts);

  for (const [eventType, count] of counts) {
    if (count === 0) {
      throw new Error(
        "INCONCLUSIVE: no real server-owned " +
          eventType +
          " events are available in production for certification",
      );
    }
    console.log("PASS " + eventType + ": " + count + " real server-owned records validated");
  }

  const unauthorizedRevenueResponse = await request("/api/admin/analytics/revenue");
  equal(unauthorizedRevenueResponse.status, 401, "unauthenticated admin revenue status");
  equal(
    unauthorizedRevenueResponse.headers.get("cache-control")?.toLowerCase(),
    "no-store",
    "admin revenue cache policy",
  );
  console.log("PASS admin revenue endpoint rejects unauthenticated access and disables caching");

  console.log(
    "PASS Phase 10.4 production verification: read-only D1 evidence; no synthetic carts, events, orders, payments or refunds were created.",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("INCONCLUSIVE:")) {
    console.warn("INCONCLUSIVE Phase 10.4 production verification: " + message);
    process.exitCode = 2;
  } else {
    console.error("FAIL Phase 10.4 production verification: " + message);
    process.exitCode = 1;
  }
}

if (process.exitCode === undefined) {
  console.log("Phase 10.4 production verification passed for " + BASE_URL);
}
