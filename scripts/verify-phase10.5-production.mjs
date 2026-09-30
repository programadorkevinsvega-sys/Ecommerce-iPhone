const pollIntervalMs = Number(process.env.PHASE10_5_POLL_INTERVAL_MS ?? "5000");
const pollAttempts = Number(process.env.PHASE10_5_POLL_ATTEMPTS ?? "24");

const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
const execFileAsync = promisify(execFile);

const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");

async function request(path) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: { accept: "application/json" },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function waitForRevenueProjection() {
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const rows = await d1(
      `SELECT COUNT(*) AS missing
       FROM payment_ledger pl
       WHERE pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
         AND NOT EXISTS (
           SELECT 1 FROM analytics_events ae
           WHERE ae.event_id='revenue:' || pl.id
         )`,
    );
    const missing = Number(rows[0]?.missing ?? 0);
    if (missing === 0) {
      console.log(`PASS canonical payment ledger fully projected to RevenueRecorded after ${attempt} poll(s)`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`RevenueRecorded projection is incomplete after ${pollAttempts} polls`);
}

try {
  const adminResponse = await request("/api/admin/analytics/revenue");
  assert(adminResponse.status === 401, `admin revenue authorization guard: expected HTTP 401, got ${adminResponse.status}`);
  console.log("PASS admin revenue authorization guard: HTTP 401");

  await waitForRevenueProjection();

  const ledger = await d1(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type='PAYMENT_CONFIRMED' THEN amount_in_cents ELSE 0 END),0) AS gross,
       COALESCE(SUM(CASE WHEN entry_type='PAYMENT_REFUNDED' THEN amount_in_cents ELSE 0 END),0) AS refunded,
       COUNT(CASE WHEN entry_type='PAYMENT_CONFIRMED' THEN 1 END) AS payments,
       COUNT(CASE WHEN entry_type='PAYMENT_REFUNDED' THEN 1 END) AS refunds
     FROM payment_ledger
     WHERE entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')`,
  );
  const events = await d1(
    `SELECT
       COALESCE(SUM(CASE WHEN json_extract(payload_json,'$.revenueDirection')='CREDIT' THEN CAST(json_extract(payload_json,'$.amountInCents') AS INTEGER) ELSE 0 END),0) AS gross,
       COALESCE(SUM(CASE WHEN json_extract(payload_json,'$.revenueDirection')='DEBIT' THEN CAST(json_extract(payload_json,'$.amountInCents') AS INTEGER) ELSE 0 END),0) AS refunded,
       COUNT(CASE WHEN json_extract(payload_json,'$.revenueDirection')='CREDIT' THEN 1 END) AS payments,
       COUNT(CASE WHEN json_extract(payload_json,'$.revenueDirection')='DEBIT' THEN 1 END) AS refunds
     FROM analytics_events
     WHERE event_type='RevenueRecorded' AND source='server'`,
  );
  assert(Number(ledger[0]?.gross ?? 0) === Number(events[0]?.gross ?? 0), "gross revenue projection mismatch");
  assert(Number(ledger[0]?.refunded ?? 0) === Number(events[0]?.refunded ?? 0), "refund revenue projection mismatch");
  assert(Number(ledger[0]?.payments ?? 0) === Number(events[0]?.payments ?? 0), "confirmed payment count mismatch");
  assert(Number(ledger[0]?.refunds ?? 0) === Number(events[0]?.refunds ?? 0), "refund count mismatch");
  console.log(
    `PASS revenue reconciliation: gross=${Number(ledger[0]?.gross ?? 0)} refunded=${Number(ledger[0]?.refunded ?? 0)} net=${Number(ledger[0]?.gross ?? 0) - Number(ledger[0]?.refunded ?? 0)}`,
  );

  const orphanEvents = await d1(
    `SELECT COUNT(*) AS count
     FROM analytics_events ae
     WHERE ae.event_type='RevenueRecorded'
       AND ae.source='server'
       AND NOT EXISTS (
         SELECT 1 FROM payment_ledger pl
         WHERE ae.event_id='revenue:' || pl.id
       )`,
  );
  assert(Number(orphanEvents[0]?.count ?? 0) === 0, "RevenueRecorded contains an event without a canonical payment ledger entry");
  console.log("PASS RevenueRecorded traceability: every server revenue event maps to payment_ledger");

  const funnel = await d1(
    `SELECT
       (SELECT COUNT(*) FROM analytics_events WHERE event_type='CheckoutStarted') AS checkouts,
       (SELECT COUNT(*) FROM analytics_events WHERE event_type='PurchaseCompleted' AND source='server') AS purchases`,
  );
  const checkouts = Number(funnel[0]?.checkouts ?? 0);
  const purchases = Number(funnel[0]?.purchases ?? 0);
  const conversionRate = checkouts === 0 ? 0 : purchases / checkouts;
  assert(Number.isFinite(conversionRate) && conversionRate >= 0, "conversion rate is invalid");
  console.log(
    `PASS conversion metric: PurchaseCompleted=${purchases} / CheckoutStarted=${checkouts} = ${conversionRate.toFixed(6)}`,
  );

  const sensitive = await d1(
    `SELECT COUNT(*) AS count
     FROM analytics_events
     WHERE event_type='RevenueRecorded'
       AND (
         instr(payload_json,'password')>0 OR
         instr(payload_json,'token')>0 OR
         instr(payload_json,'secret')>0 OR
         instr(payload_json,'email')>0 OR
         instr(payload_json,'cardNumber')>0
       )`,
  );
  assert(Number(sensitive[0]?.count ?? 0) === 0, "RevenueRecorded contains a forbidden sensitive field");
  console.log("PASS revenue analytics payload minimization");
} catch (error) {
  console.error(`FAIL Phase 10.5 production verification: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

console.log("Phase 10.5 production verification completed");
