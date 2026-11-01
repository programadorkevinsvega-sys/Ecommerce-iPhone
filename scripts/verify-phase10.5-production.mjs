const pollIntervalMs = Number(process.env.PHASE10_5_POLL_INTERVAL_MS ?? "5000");
const pollAttempts = Number(process.env.PHASE10_5_POLL_ATTEMPTS ?? "24");
const periodDays = Number(process.env.PHASE10_5_PERIOD_DAYS ?? "30");

const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
const execFileAsync = promisify(execFile);

const BASE_URL = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const to = new Date();
const from = new Date(
  to.getTime() - (Number.isFinite(periodDays) ? periodDays : 30) * 24 * 60 * 60 * 1000,
);
const fromIso = from.toISOString();
const toIso = to.toISOString();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, label) {
  assert(actual === expected, `${label}: expected ${String(expected)}, got ${String(actual)}`);
}

async function request(path) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: { accept: "application/json" },
  });
}

async function d1(sql) {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", "--remote", "--json", "--command", sql],
    { env: process.env, maxBuffer: 4 * 1024 * 1024 },
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
       LEFT JOIN payments p ON p.id=pl.payment_id
       LEFT JOIN analytics_events ae ON ae.event_id='revenue:' || pl.id
       WHERE pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
         AND (p.id IS NULL OR ae.event_id IS NULL)`,
    );
    const missing = Number(rows[0]?.missing ?? 0);
    if (missing === 0) {
      console.log(`PASS all eligible ledger entries have a projection after ${attempt} poll(s)`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`RevenueRecorded projection is incomplete after ${pollAttempts} polls`);
}

function payloadOf(row) {
  try {
    return JSON.parse(row.payload_json);
  } catch {
    throw new Error(`RevenueRecorded payload is invalid JSON for ledger ${row.ledgerId}`);
  }
}

async function verifyRowLevelProjection() {
  const rows = await d1(
    `SELECT
       pl.id AS ledgerId,
       pl.payment_id AS paymentId,
       p.order_id AS orderId,
       o.id AS persistedOrderId,
       o.total_in_cents AS orderTotalInCents,
       o.currency AS orderCurrency,
       o.status AS orderStatus,
       p.amount_in_cents AS paymentAmountInCents,
       p.currency AS paymentCurrency,
       p.status AS paymentStatus,
       EXISTS (
         SELECT 1 FROM payment_ledger confirmed
         WHERE confirmed.payment_id=pl.payment_id
           AND confirmed.entry_type='PAYMENT_CONFIRMED'
       ) AS hasConfirmedPayment,
       EXISTS (
         SELECT 1 FROM payment_refunds pr
         WHERE pr.payment_id=pl.payment_id
           AND pr.status='SUCCEEDED'
           AND pr.amount_in_cents=pl.amount_in_cents
           AND pr.currency=pl.currency
           AND pr.provider_refund_id=json_extract(pl.metadata_json,'$.providerRefundId')
       ) AS hasProviderRefund,
       pl.entry_type AS entryType,
       pl.amount_in_cents AS amountInCents,
       pl.currency AS currency,
       ae.event_id AS eventId,
       ae.event_type AS eventType,
       ae.source AS source,
       ae.payload_json AS payloadJson
     FROM payment_ledger pl
     LEFT JOIN payments p ON p.id=pl.payment_id
     LEFT JOIN orders o ON o.id=p.order_id
     LEFT JOIN analytics_events ae ON ae.event_id='revenue:' || pl.id
     WHERE pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
     ORDER BY pl.created_at ASC,pl.id ASC`,
  );

  if (rows.length === 0)
    throw new Error("INCONCLUSIVE: no eligible payment ledger entries exist in production");
  if (!rows.some((row) => row.entryType === "PAYMENT_CONFIRMED"))
    throw new Error("INCONCLUSIVE: no confirmed payment ledger entry exists in production");
  if (!rows.some((row) => row.entryType === "PAYMENT_REFUNDED"))
    throw new Error(
      "INCONCLUSIVE: no provider-confirmed refund ledger entry exists in production; do not create a refund only for this probe",
    );

  const currencyLedger = new Map();
  const currencyProjection = new Map();
  for (const row of rows) {
    assert(row.orderId, `ledger ${row.ledgerId} references a missing payment/order`);
    equal(row.persistedOrderId, row.orderId, `persisted order reference for ${row.ledgerId}`);
    equal(row.paymentCurrency, row.currency, `ledger/payment currency for ${row.ledgerId}`);
    equal(row.orderCurrency, row.paymentCurrency, `payment/order currency for ${row.ledgerId}`);
    equal(
      Number(row.paymentAmountInCents),
      Number(row.orderTotalInCents),
      `payment/order amount for ${row.ledgerId}`,
    );
    assert(
      ["PAID", "REFUNDED"].includes(row.paymentStatus),
      `ledger ${row.ledgerId} has an ineligible payment state`,
    );
    if (row.entryType === "PAYMENT_CONFIRMED") {
      assert(
        [
          "PAID",
          "CANCELLED",
          "PROCESSING",
          "READY_TO_SHIP",
          "SHIPPED",
          "DELIVERED",
          "REFUND_PENDING",
          "REFUNDED",
        ].includes(row.orderStatus),
        `ledger ${row.ledgerId} has an incompatible order state`,
      );
      equal(
        Number(row.paymentAmountInCents),
        Number(row.amountInCents),
        `confirmed amount vs payment for ${row.ledgerId}`,
      );
    } else {
      equal(row.paymentStatus, "REFUNDED", `refund payment state for ${row.ledgerId}`);
      equal(row.orderStatus, "REFUNDED", `refund order state for ${row.ledgerId}`);
      equal(Number(row.hasConfirmedPayment), 1, `refund sale linkage for ${row.ledgerId}`);
      equal(Number(row.hasProviderRefund), 1, `provider-confirmed refund row for ${row.ledgerId}`);
      equal(
        Number(row.amountInCents),
        Number(row.paymentAmountInCents),
        `full refund amount for ${row.ledgerId}`,
      );
    }
    assert(row.eventId, `ledger ${row.ledgerId} has no RevenueRecorded projection`);
    equal(row.eventId, `revenue:${row.ledgerId}`, `event ID for ${row.ledgerId}`);
    equal(row.eventType, "RevenueRecorded", `event type for ${row.ledgerId}`);
    equal(row.source, "server", `event source for ${row.ledgerId}`);

    const payload = payloadOf({ ...row, payload_json: row.payloadJson });
    const expectedDirection = row.entryType === "PAYMENT_REFUNDED" ? "DEBIT" : "CREDIT";
    const amount = Number(row.amountInCents);
    assert(
      Number.isSafeInteger(amount) && amount >= 0,
      `ledger amount is not a safe integer for ${row.ledgerId}`,
    );
    equal(payload.ledgerId, row.ledgerId, `payload ledgerId for ${row.ledgerId}`);
    equal(payload.paymentId, row.paymentId, `payload paymentId for ${row.ledgerId}`);
    equal(payload.orderId, row.orderId, `payload orderId for ${row.ledgerId}`);
    equal(payload.entryType, row.entryType, `payload entryType for ${row.ledgerId}`);
    equal(Number(payload.amountInCents), amount, `payload amount for ${row.ledgerId}`);
    equal(payload.currency, row.currency, `payload currency for ${row.ledgerId}`);
    equal(payload.revenueDirection, expectedDirection, `payload direction for ${row.ledgerId}`);
    equal(
      Number(payload.netAmountInCents),
      expectedDirection === "DEBIT" ? -amount : amount,
      `payload signed amount for ${row.ledgerId}`,
    );

    const ledgerAggregate = currencyLedger.get(row.currency) ?? {
      gross: 0,
      refunded: 0,
      paymentIds: new Set(),
      refunds: 0,
      entries: 0,
    };
    const projectionAggregate = currencyProjection.get(row.currency) ?? {
      gross: 0,
      refunded: 0,
      paymentIds: new Set(),
      refunds: 0,
      entries: 0,
    };
    if (row.entryType === "PAYMENT_CONFIRMED") {
      ledgerAggregate.gross += amount;
      ledgerAggregate.paymentIds.add(row.paymentId);
      projectionAggregate.gross += Number(payload.amountInCents);
      projectionAggregate.paymentIds.add(payload.paymentId);
    } else {
      ledgerAggregate.refunded += amount;
      ledgerAggregate.refunds += 1;
      projectionAggregate.refunded += Number(payload.amountInCents);
      projectionAggregate.refunds += 1;
    }
    ledgerAggregate.entries += 1;
    projectionAggregate.entries += 1;
    currencyLedger.set(row.currency, ledgerAggregate);
    currencyProjection.set(row.currency, projectionAggregate);
  }

  for (const [currency, ledger] of currencyLedger) {
    const projected = currencyProjection.get(currency);
    assert(projected, `missing projection aggregate for ${currency}`);
    equal(projected.gross, ledger.gross, `${currency} gross revenue`);
    equal(projected.refunded, ledger.refunded, `${currency} refunds`);
    equal(projected.paymentIds.size, ledger.paymentIds.size, `${currency} confirmed payment count`);
    equal(projected.refunds, ledger.refunds, `${currency} refund count`);
    equal(projected.entries, ledger.entries, `${currency} projected ledger entry count`);
    console.log(
      `PASS ${currency}: gross=${ledger.gross} refunds=${ledger.refunded} net=${ledger.gross - ledger.refunded}; payments=${ledger.paymentIds.size}; refunds=${ledger.refunds}; entries=${ledger.entries}`,
    );
  }
  console.log(`PASS row-level ledger reconciliation: ${rows.length} eligible entries`);
}

try {
  assert(
    Number.isInteger(periodDays) && periodDays > 0 && periodDays <= 366,
    "PHASE10_5_PERIOD_DAYS must be an integer from 1 to 366",
  );

  const adminResponse = await request("/api/admin/analytics/revenue");
  equal(adminResponse.status, 401, "unauthenticated admin revenue status");
  equal(
    adminResponse.headers.get("cache-control")?.toLowerCase(),
    "no-store",
    "admin revenue cache policy",
  );
  console.log("PASS admin revenue authorization guard and no-store response");

  const orphanLedger = await d1(
    `SELECT COUNT(*) AS count
     FROM payment_ledger pl
     LEFT JOIN payments p ON p.id=pl.payment_id
     WHERE pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
       AND p.id IS NULL`,
  );
  equal(Number(orphanLedger[0]?.count ?? 0), 0, "orphan eligible ledger entries");

  await waitForRevenueProjection();
  await verifyRowLevelProjection();

  const duplicateLedgerEntries = await d1(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT payment_id,entry_type
       FROM payment_ledger
       WHERE entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
       GROUP BY payment_id,entry_type
       HAVING COUNT(*)>1
     ) duplicates`,
  );
  equal(
    Number(duplicateLedgerEntries[0]?.count ?? 0),
    0,
    "duplicate canonical payment ledger entries",
  );
  const successfulRefundsWithoutLedger = await d1(
    `SELECT COUNT(*) AS count
     FROM payment_refunds pr
     WHERE pr.status='SUCCEEDED'
       AND NOT EXISTS (
         SELECT 1 FROM payment_refund_locks active_lock
         WHERE active_lock.payment_id=pr.payment_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM payment_ledger pl
         WHERE pl.payment_id=pr.payment_id
           AND pl.entry_type='PAYMENT_REFUNDED'
           AND pl.amount_in_cents=pr.amount_in_cents
           AND pl.currency=pr.currency
           AND json_extract(pl.metadata_json,'$.providerRefundId')=pr.provider_refund_id
       )`,
  );
  equal(
    Number(successfulRefundsWithoutLedger[0]?.count ?? 0),
    0,
    "provider-confirmed refunds missing matching PAYMENT_REFUNDED ledger entries",
  );

  const refundedPaymentTotals = await d1(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT p.id
       FROM payments p
       LEFT JOIN payment_ledger refunds
         ON refunds.payment_id=p.id AND refunds.entry_type='PAYMENT_REFUNDED'
       WHERE p.status='REFUNDED'
         AND NOT EXISTS (
           SELECT 1 FROM payment_refund_locks active_lock
           WHERE active_lock.payment_id=p.id
         )
       GROUP BY p.id,p.amount_in_cents
       HAVING COALESCE(SUM(refunds.amount_in_cents),0)<>p.amount_in_cents
     ) invalidRefundedPayments`,
  );
  equal(
    Number(refundedPaymentTotals[0]?.count ?? 0),
    0,
    "refunded payments must have exactly one full refund ledger entry",
  );

  const unledgeredPaidPayments = await d1(
    `SELECT COUNT(*) AS count
     FROM payments p
     WHERE p.status IN ('PAID','REFUNDED')
       AND p.updated_at<=datetime('now','-5 minutes')
       AND NOT EXISTS (
         SELECT 1 FROM payment_ledger confirmed
         WHERE confirmed.payment_id=p.id AND confirmed.entry_type='PAYMENT_CONFIRMED'
       )`,
  );
  equal(
    Number(unledgeredPaidPayments[0]?.count ?? 0),
    0,
    "paid payments missing their confirmed ledger entry",
  );

  const overRefunded = await d1(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT p.id
       FROM payments p
       INNER JOIN payment_ledger refunds
         ON refunds.payment_id=p.id AND refunds.entry_type='PAYMENT_REFUNDED'
       GROUP BY p.id,p.amount_in_cents
       HAVING SUM(refunds.amount_in_cents)>p.amount_in_cents
     ) invalidRefundTotals`,
  );
  equal(Number(overRefunded[0]?.count ?? 0), 0, "cumulative refunds exceed payment amount");

  const orphanEvents = await d1(
    `SELECT COUNT(*) AS count
     FROM analytics_events ae
     WHERE ae.event_type='RevenueRecorded'
       AND ae.source='server'
       AND NOT EXISTS (
         SELECT 1 FROM payment_ledger pl
         WHERE ae.event_id='revenue:' || pl.id
           AND pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
       )`,
  );
  equal(Number(orphanEvents[0]?.count ?? 0), 0, "orphan RevenueRecorded events");

  const duplicateLedgerIds = await d1(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT json_extract(payload_json,'$.ledgerId') AS ledgerId
       FROM analytics_events
       WHERE event_type='RevenueRecorded' AND source='server'
       GROUP BY json_extract(payload_json,'$.ledgerId')
       HAVING COUNT(*)>1
     ) duplicates`,
  );
  equal(Number(duplicateLedgerIds[0]?.count ?? 0), 0, "duplicate ledgerId projections");

  const nonServerRevenue = await d1(
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type='RevenueRecorded' AND source<>'server'",
  );
  equal(Number(nonServerRevenue[0]?.count ?? 0), 0, "non-server RevenueRecorded events");

  const sensitive = await d1(
    `SELECT COUNT(*) AS count
     FROM analytics_events
     WHERE event_type='RevenueRecorded'
       AND (
         instr(lower(payload_json),'password')>0 OR
         instr(lower(payload_json),'token')>0 OR
         instr(lower(payload_json),'secret')>0 OR
         instr(lower(payload_json),'email')>0 OR
         instr(lower(payload_json),'phone')>0 OR
         instr(lower(payload_json),'address')>0 OR
         instr(lower(payload_json),'cardnumber')>0 OR
         instr(lower(payload_json),'authorization')>0
       )`,
  );
  equal(Number(sensitive[0]?.count ?? 0), 0, "sensitive RevenueRecorded payloads");

  const funnel = await d1(
    `SELECT
       COUNT(DISTINCT CASE
         WHEN event_type='CheckoutStarted' THEN json_extract(payload_json,'$.orderId')
       END) AS checkouts,
       COUNT(DISTINCT CASE
         WHEN event_type='PurchaseCompleted' THEN json_extract(payload_json,'$.paymentId')
       END) AS purchases
     FROM analytics_events
     WHERE source='server'
       AND event_type IN ('CheckoutStarted','PurchaseCompleted')
       AND occurred_at>='${fromIso}' AND occurred_at<'${toIso}'`,
  );
  const checkouts = Number(funnel[0]?.checkouts ?? 0);
  const purchases = Number(funnel[0]?.purchases ?? 0);
  if (checkouts === 0 || purchases === 0) {
    throw new Error(
      "INCONCLUSIVE: production has no real checkout and purchase events in the selected conversion window",
    );
  }
  const conversionRate = checkouts === 0 ? 0 : purchases / checkouts;
  assert(Number.isFinite(conversionRate) && conversionRate >= 0, "conversion rate is invalid");
  console.log(
    `PASS conversion window UTC ${fromIso} to ${toIso}: PurchaseCompleted=${purchases} / CheckoutStarted=${checkouts} = ${conversionRate.toFixed(6)}`,
  );
  if (purchases > checkouts) {
    console.warn(
      "WARN conversion exceeds 100%: the period can include PurchaseCompleted events whose CheckoutStarted occurred before this period; review cohort alignment, do not interpret this as a single-checkout conversion rate.",
    );
  }

  console.log(
    "PASS per-ledger traceability, currency separation, orphan checks, duplicate checks and payload minimization",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("INCONCLUSIVE:")) {
    console.warn(`INCONCLUSIVE Phase 10.5 production verification: ${message}`);
    process.exitCode = 2;
  } else {
    console.error(`FAIL Phase 10.5 production verification: ${message}`);
    process.exitCode = 1;
  }
}

if (process.exitCode === undefined) {
  console.log(`Phase 10.5 production verification passed for ${BASE_URL}`);
}
