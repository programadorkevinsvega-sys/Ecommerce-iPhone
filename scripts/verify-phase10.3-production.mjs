const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.PHASE10_3_TIMEOUT_MS ?? "15000");
const pollIntervalMs = Number(process.env.PHASE10_3_POLL_INTERVAL_MS ?? "3000");
const pollAttempts = Number(process.env.PHASE10_3_POLL_ATTEMPTS ?? "20");

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

function extractProduct(html) {
  const match = html.match(/<script[^>]*id="product-jsonld"[^>]*>([\s\S]*?)<\/script>/i);
  assert(match, "product JSON-LD script was not found");
  const json = JSON.parse(match[1]);
  assert(typeof json.sku === "string" && json.sku.length >= 8, "product JSON-LD did not expose a valid SKU");
  const brand = typeof json.brand?.name === "string" ? json.brand.name : "unknown";
  const condition =
    typeof json.offers?.itemCondition === "string" && json.offers.itemCondition.endsWith("/NewCondition")
      ? "NEW"
      : typeof json.offers?.itemCondition === "string" && json.offers.itemCondition.endsWith("/UsedCondition")
        ? "USED"
        : "REFURBISHED";
  const stockAvailable = json.offers?.availability === "https://schema.org/InStock";
  return { productId: json.sku, brand, condition, stockAvailable };
}

const probe = crypto.randomUUID();
const visitorId = `phase10-3-visitor-${probe}`;
const sessionId = `phase10-3-session-${probe}`;
const requestId = `phase10-3-request-${probe}`;
const productEventId = `phase10-3-product-${probe}`;
const searchEventId = `phase10-3-search-${probe}`;
const searchTermLength = `phase10-3-${probe}`.length;
const eventIds = [productEventId, searchEventId];

let completed = false;

try {
  const preferredProductRows = await d1(
    "SELECT id,slug,stock FROM products WHERE slug='iphone-17-pro-max' AND active=1 LIMIT 1",
  );
  const productRows = preferredProductRows.length > 0
    ? preferredProductRows
    : await d1("SELECT id,slug,stock FROM products WHERE active=1 ORDER BY updated_at DESC LIMIT 1");
  assert(productRows.length === 1, "no active production product available for real catalog verification");
  const verificationSlug = productRows[0].slug;
  const productResponse = await request(`/iphone/${encodeURIComponent(verificationSlug)}`, {
    headers: { "x-request-id": requestId },
  });
  const productHtml = await productResponse.text();
  assert(productResponse.status === 200, `catalog product route: expected HTTP 200, got ${productResponse.status}`);
  const product = extractProduct(productHtml);
  console.log(`PASS real product route: /iphone/${verificationSlug} HTTP 200${preferredProductRows.length === 0 ? " (fallback because iphone-17-pro-max is inactive)" : ""}`);

  const searchResponse = await request(`/catalog?q=${encodeURIComponent("phase10-3-verification")}`);
  assert(searchResponse.status === 200, `catalog search route: expected HTTP 200, got ${searchResponse.status}`);
  console.log("PASS real catalog search route: HTTP 200");

  const productEvent = {
    eventId: productEventId,
    eventType: "ProductViewed",
    occurredAt: new Date().toISOString(),
    sessionId,
    visitorId,
    requestId,
    payload: {
      productId: product.productId,
      brand: product.brand,
      condition: product.condition,
      stockAvailable: product.stockAvailable,
      hasVariants: false,
    },
  };

  const searchEvent = {
    eventId: searchEventId,
    eventType: "SearchPerformed",
    occurredAt: new Date().toISOString(),
    sessionId,
    visitorId,
    requestId,
    payload: {
      queryPresent: true,
      queryLength: searchTermLength,
      resultCount: 0,
      page: 1,
      pageSize: 12,
      sort: "newest",
      hasBrandFilter: false,
      hasCategoryFilter: false,
      hasConditionFilter: false,
    },
  };

  for (const event of [productEvent, searchEvent]) {
    const response = await request("/api/analytics/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify(event),
    });
    const body = await response.text();
    assert(response.status === 202, `analytics ${event.eventType}: expected HTTP 202, got ${response.status}: ${body.slice(0, 300)}`);
    console.log(`PASS analytics ${event.eventType}: HTTP 202`);
  }

  const duplicate = await request("/api/analytics/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify(productEvent),
  });
  assert(duplicate.status === 202, `ProductViewed idempotency ingest: expected HTTP 202, got ${duplicate.status}`);
  console.log("PASS ProductViewed idempotency ingest: HTTP 202");

  const lookup = `SELECT event_id,event_type,event_version,session_id,visitor_id,request_id,source,payload_json FROM analytics_events WHERE event_id IN (${eventIds.map(sqlString).join(",")}) ORDER BY event_id`;

  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const rows = await d1(lookup);
    if (rows.length === 2) {
      const productRow = rows.find((row) => row.event_id === productEventId);
      const searchRow = rows.find((row) => row.event_id === searchEventId);
      assert(productRow?.event_type === "ProductViewed", "ProductViewed was not persisted with the expected type");
      assert(searchRow?.event_type === "SearchPerformed", "SearchPerformed was not persisted with the expected type");
      assert(Number(productRow.event_version) === 1 && Number(searchRow.event_version) === 1, "catalog analytics event version mismatch");
      assert(productRow.session_id === sessionId && searchRow.session_id === sessionId, "catalog analytics session mismatch");
      assert(productRow.visitor_id === visitorId && searchRow.visitor_id === visitorId, "catalog analytics visitor mismatch");
      assert(productRow.source === "web" && searchRow.source === "web", "catalog analytics source mismatch");
      assert(typeof productRow.payload_json === "string" && productRow.payload_json.includes(product.productId), "ProductViewed payload does not reference the real product");
      assert(typeof searchRow.payload_json === "string" && !searchRow.payload_json.includes("phase10-3-verification"), "SearchPerformed stored the raw search query");
      console.log(`PASS HTTP → EVENTS_QUEUE → D1: catalog/search events persisted after ${attempt} poll(s)`);
      console.log("PASS analytics idempotency: ProductViewed has exactly one D1 row");
      completed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  assert(completed, `catalog analytics queue persistence timeout after ${pollAttempts} polls`);
} finally {
  try {
    await d1(`DELETE FROM analytics_events WHERE event_id IN (${eventIds.map(sqlString).join(",")})`);
    console.log("PASS production verification cleanup: catalog probe events removed from D1");
  } catch (error) {
    console.error(`WARN production verification cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    if (completed) throw error;
  }
}

console.log(`Phase 10.3 production verification passed for ${BASE_URL}`);
