const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.PHASE10_2_TIMEOUT_MS ?? "15000");
const pollIntervalMs = Number(process.env.PHASE10_2_POLL_INTERVAL_MS ?? "3000");
const pollAttempts = Number(process.env.PHASE10_2_POLL_ATTEMPTS ?? "20");
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
        accept: "application/json",
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

const eventId = `phase10-2-${crypto.randomUUID()}`;
const sessionId = `phase10-2-session-${crypto.randomUUID()}`;
const visitorId = `phase10-2-visitor-${crypto.randomUUID()}`;
const requestId = `phase10-2-request-${crypto.randomUUID()}`;

const event = {
  eventId,
  eventType: "SessionStarted",
  occurredAt: new Date().toISOString(),
  sessionId,
  visitorId,
  requestId,
  payload: { verification: "phase10.2-production" },
};

let completed = false;

try {
  const first = await request("/api/analytics/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify(event),
  });
  const firstBody = await first.text();
  assert(first.status === 202, `analytics ingest: expected HTTP 202, got ${first.status}: ${firstBody.slice(0, 300)}`);
  console.log(`PASS analytics ingest: HTTP ${first.status}`);

  const duplicate = await request("/api/analytics/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify(event),
  });
  const duplicateBody = await duplicate.text();
  assert(duplicate.status === 202, `analytics idempotency ingest: expected HTTP 202, got ${duplicate.status}: ${duplicateBody.slice(0, 300)}`);
  console.log(`PASS analytics idempotency ingest: HTTP ${duplicate.status}`);

  const lookup = `SELECT event_id,event_type,event_version,session_id,visitor_id,request_id,source,payload_json FROM analytics_events WHERE event_id=${sqlString(eventId)} LIMIT 2`;

  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const rows = await d1(lookup);
    if (rows.length === 1) {
      const row = rows[0];
      assert(row.event_id === eventId, "analytics D1 event_id mismatch");
      assert(row.event_type === "SessionStarted", "analytics D1 event_type mismatch");
      assert(Number(row.event_version) === 1, "analytics D1 event_version mismatch");
      assert(row.session_id === sessionId, "analytics D1 session_id mismatch");
      assert(row.visitor_id === visitorId, "analytics D1 visitor_id mismatch");
      assert(row.request_id === requestId, "analytics D1 request_id mismatch");
      assert(row.source === "web", "analytics D1 source mismatch");
      assert(typeof row.payload_json === "string" && row.payload_json.includes("phase10.2-production"), "analytics D1 payload mismatch");
      console.log(`PASS HTTP → EVENTS_QUEUE → D1: event persisted after ${attempt} poll(s)`);
      console.log("PASS analytics idempotency: exactly one D1 row for repeated event_id");
      completed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  assert(completed, `analytics queue persistence timeout: event ${eventId} was not observed in D1 after ${pollAttempts} polls`);

  const expiredCount = await d1("SELECT COUNT(*) AS count FROM analytics_events WHERE expires_at<=CURRENT_TIMESTAMP");
  assert(expiredCount.length === 1, "analytics retention query did not return exactly one aggregate row");
  console.log(`PASS analytics retention metadata query: expired rows currently visible=${expiredCount[0].count}`);
} finally {
  try {
    await d1(`DELETE FROM analytics_events WHERE event_id=${sqlString(eventId)}`);
    console.log("PASS production verification cleanup: probe event removed from D1");
  } catch (error) {
    console.error(`WARN production verification cleanup failed for probe ${eventId}: ${error instanceof Error ? error.message : String(error)}`);
    if (completed) throw error;
  }
}

console.log(`Phase 10.2 production verification passed for ${BASE_URL}`);
