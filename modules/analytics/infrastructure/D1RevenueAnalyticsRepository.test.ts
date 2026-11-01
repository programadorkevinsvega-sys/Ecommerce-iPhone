import { describe, expect, it } from "vitest";
import { D1RevenueAnalyticsRepository } from "./D1RevenueAnalyticsRepository";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";

function insertPayment(
  database: D1SqliteTestDatabase,
  paymentId: string,
  orderId: string,
  currency: string,
  ledgerId: string,
  amount: number,
) {
  const customerId = `customer-${paymentId}`;
  database.exec(
    "INSERT INTO orders (id,order_number,customer_id,email,status,currency,subtotal_in_cents,shipping_in_cents,discount_in_cents,total_in_cents,shipping_method,shipping_recipient_name,shipping_phone,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    orderId,
    `ORD-${orderId}`,
    customerId,
    `${customerId}@example.test`,
    "PAID",
    currency,
    amount,
    0,
    0,
    amount,
    "PICKUP",
    "Test Customer",
    "3000000000",
    "Test Street",
    null,
    "Medellin",
    "Antioquia",
    null,
    "CO",
  );
  database.exec(
    "INSERT INTO payments (id,order_id,customer_id,status,amount_in_cents,currency) VALUES (?,?,?,?,?,?)",
    paymentId,
    orderId,
    customerId,
    "PAID",
    amount,
    currency,
  );
  database.exec(
    "INSERT INTO payment_ledger (id, payment_id, entry_type, amount_in_cents, currency, created_at) VALUES (?, ?, 'PAYMENT_CONFIRMED', ?, ?, ?)",
    ledgerId,
    paymentId,
    amount,
    currency,
    "2026-09-15 12:01:00",
  );
}

function insertAnalyticsEvent(
  database: D1SqliteTestDatabase,
  eventId: string,
  eventType: string,
  source: "web" | "server",
  payload: Record<string, unknown>,
) {
  database.exec(
    "INSERT INTO analytics_events (event_id, event_type, event_version, occurred_at, received_at, session_id, visitor_id, request_id, source, payload_json, expires_at) VALUES (?, ?, 1, ?, ?, ?, ?, NULL, ?, ?, ?)",
    eventId,
    eventType,
    "2026-09-15T12:00:00.000Z",
    "2026-09-15T12:00:01.000Z",
    "session-12345678",
    "visitor-12345678",
    source,
    JSON.stringify(payload),
    "2027-03-15T12:00:00.000Z",
  );
}

describe("D1RevenueAnalyticsRepository", () => {
  it("uses canonical server events for conversion and matches ledger amounts", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      database.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      database.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      partialDatabase.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      insertPayment(database, "payment-1", "order-1", "COP", "ledger-sale-1", 10000);
      database.exec(
        "INSERT INTO payment_refunds (id,payment_id,idempotency_key,provider_refund_id,status,amount_in_cents,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        "refund-1",
        "payment-1",
        "refund-key-1",
        "provider-refund-1",
        "SUCCEEDED",
        10000,
        "COP",
        "2026-09-16 12:00:00",
        "2026-09-16 12:00:00",
      );
      database.exec(
        "INSERT INTO payment_ledger (id,payment_id,entry_type,amount_in_cents,currency,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)",
        "ledger-refund-1",
        "payment-1",
        "PAYMENT_REFUNDED",
        10000,
        "COP",
        JSON.stringify({ providerRefundId: "provider-refund-1", idempotencyKey: "refund-key-1" }),
        "2026-09-16 12:01:00",
      );

      database.exec("UPDATE payments SET status='REFUNDED' WHERE id=?", "payment-1");
      database.exec("UPDATE orders SET status='REFUNDED' WHERE id=?", "order-1");

      insertAnalyticsEvent(database, "forged-checkout-1", "CheckoutStarted", "web", {
        orderId: "forged-order",
      });
      insertAnalyticsEvent(database, "forged-purchase-1", "PurchaseCompleted", "web", {
        paymentId: "forged-payment",
      });
      insertAnalyticsEvent(database, "checkout-1", "CheckoutStarted", "server", {
        orderId: "order-1",
      });
      insertAnalyticsEvent(database, "purchase-1", "PurchaseCompleted", "server", {
        orderId: "order-1",
        paymentId: "payment-1",
      });

      const repository = new D1RevenueAnalyticsRepository(database.asD1());
      const report = await repository.report(
        "2026-09-01T00:00:00.000Z",
        "2026-10-01T00:00:00.000Z",
      );

      expect(report).toMatchObject({
        grossRevenueInCents: 10000,
        refundedRevenueInCents: 10000,
        netRevenueInCents: 0,
        financialTotalsCurrency: "COP",
        confirmedPaymentCount: 1,
        refundCount: 1,
        checkoutStartedCount: 1,
        purchaseCompletedCount: 1,
        conversionRate: 1,
        currencyBreakdown: [
          {
            currency: "COP",
            grossRevenueInCents: 10000,
            refundedRevenueInCents: 10000,
            netRevenueInCents: 0,
            confirmedPaymentCount: 1,
            refundCount: 1,
          },
        ],
      });
    } finally {
      database.close();
    }
  });

  it("never adds monetary amounts across different currencies", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      database.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      database.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      missingRefundDatabase.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      insertPayment(database, "payment-cop", "order-cop", "COP", "ledger-cop", 100000);
      insertPayment(database, "payment-usd", "order-usd", "USD", "ledger-usd", 2500);

      const repository = new D1RevenueAnalyticsRepository(database.asD1());
      const report = await repository.report(
        "2026-09-01T00:00:00.000Z",
        "2026-10-01T00:00:00.000Z",
      );

      expect(report.grossRevenueInCents).toBeNull();
      expect(report.refundedRevenueInCents).toBeNull();
      expect(report.netRevenueInCents).toBeNull();
      expect(report.financialTotalsCurrency).toBeNull();
      expect(report.currencyBreakdown).toEqual([
        {
          currency: "COP",
          grossRevenueInCents: 100000,
          refundedRevenueInCents: 0,
          netRevenueInCents: 100000,
          confirmedPaymentCount: 1,
          refundCount: 0,
        },
        {
          currency: "USD",
          grossRevenueInCents: 2500,
          refundedRevenueInCents: 0,
          netRevenueInCents: 2500,
          confirmedPaymentCount: 1,
          refundCount: 0,
        },
      ]);
    } finally {
      database.close();
    }
  });

  it("fails reconciliation selection instead of silently skipping orphan ledger entries", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      database.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      database.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      database.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      database.exec(
        "INSERT INTO payment_ledger (id, payment_id, entry_type, amount_in_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        "orphan-ledger",
        "missing-payment",
        "PAYMENT_CONFIRMED",
        500,
        "COP",
        "2026-09-15T12:00:00.000Z",
      );
      const repository = new D1RevenueAnalyticsRepository(database.asD1());
      await expect(repository.pendingRevenueEntries(50)).rejects.toThrow(
        "PAYMENT_LEDGER_INTEGRITY_MISMATCH",
      );
    } finally {
      database.close();
    }
  });
  it("rejects unsupported partial refunds and refunded payments without a matching ledger entry", async () => {
    const partialDatabase = new D1SqliteTestDatabase();
    try {
      partialDatabase.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      partialDatabase.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      database.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      insertPayment(
        partialDatabase,
        "payment-partial",
        "order-partial",
        "COP",
        "ledger-sale-partial",
        10000,
      );
      partialDatabase.exec("UPDATE payments SET status='REFUNDED' WHERE id=?", "payment-partial");
      partialDatabase.exec("UPDATE orders SET status='REFUNDED' WHERE id=?", "order-partial");
      partialDatabase.exec(
        "INSERT INTO payment_refunds (id,payment_id,idempotency_key,provider_refund_id,status,amount_in_cents,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        "refund-partial",
        "payment-partial",
        "refund-key-partial",
        "provider-refund-partial",
        "SUCCEEDED",
        5000,
        "COP",
        "2026-09-16 12:00:00",
        "2026-09-16 12:00:00",
      );
      partialDatabase.exec(
        "INSERT INTO payment_ledger (id,payment_id,entry_type,amount_in_cents,currency,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)",
        "ledger-refund-partial",
        "payment-partial",
        "PAYMENT_REFUNDED",
        5000,
        "COP",
        JSON.stringify({
          providerRefundId: "provider-refund-partial",
          idempotencyKey: "refund-key-partial",
        }),
        "2026-09-16 12:01:00",
      );
      const repository = new D1RevenueAnalyticsRepository(partialDatabase.asD1());
      await expect(repository.pendingRevenueEntries(50)).rejects.toThrow(
        "PAYMENT_LEDGER_INTEGRITY_MISMATCH",
      );
    } finally {
      partialDatabase.close();
    }

    const missingRefundDatabase = new D1SqliteTestDatabase();
    try {
      missingRefundDatabase.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      missingRefundDatabase.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      database.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      insertPayment(
        missingRefundDatabase,
        "payment-missing-refund",
        "order-missing-refund",
        "COP",
        "ledger-sale-missing-refund",
        10000,
      );
      missingRefundDatabase.exec(
        "UPDATE payments SET status='REFUNDED' WHERE id=?",
        "payment-missing-refund",
      );
      missingRefundDatabase.exec(
        "UPDATE orders SET status='REFUNDED' WHERE id=?",
        "order-missing-refund",
      );
      const repository = new D1RevenueAnalyticsRepository(missingRefundDatabase.asD1());
      await expect(repository.pendingRevenueEntries(50)).rejects.toThrow(
        "PAYMENT_LEDGER_INTEGRITY_MISMATCH",
      );
    } finally {
      missingRefundDatabase.close();
    }
  });

  it("does not classify an in-flight succeeded refund as an orphan while its refund lock is held", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      database.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      database.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      database.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      insertPayment(
        database,
        "payment-in-flight-refund",
        "order-in-flight-refund",
        "COP",
        "ledger-sale-in-flight-refund",
        10000,
      );
      database.exec(
        "INSERT INTO payment_refunds (id,payment_id,idempotency_key,provider_refund_id,status,amount_in_cents,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        "refund-in-flight",
        "payment-in-flight-refund",
        "refund-key-in-flight",
        "provider-refund-in-flight",
        "SUCCEEDED",
        10000,
        "COP",
        "2026-09-16 12:00:00",
        "2026-09-16 12:00:00",
      );
      database.exec(
        "INSERT INTO payment_refund_locks (payment_id,idempotency_key) VALUES (?,?)",
        "payment-in-flight-refund",
        "refund-key-in-flight",
      );

      const repository = new D1RevenueAnalyticsRepository(database.asD1());
      await expect(repository.pendingRevenueEntries(50)).resolves.toHaveLength(1);
    } finally {
      database.close();
    }
  });

  it("allows a recent paid transition to finish its ledger write but rejects a stale missing confirmation", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      database.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      database.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      database.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      insertPayment(
        database,
        "payment-recent-transition",
        "order-recent-transition",
        "COP",
        "ledger-sale-recent-transition",
        10000,
      );
      database.exec("DELETE FROM payment_ledger WHERE payment_id=?", "payment-recent-transition");

      const repository = new D1RevenueAnalyticsRepository(database.asD1());
      await expect(repository.pendingRevenueEntries(50)).resolves.toHaveLength(0);

      database.exec(
        "UPDATE payments SET updated_at=datetime('now','-6 minutes') WHERE id=?",
        "payment-recent-transition",
      );
      await expect(repository.pendingRevenueEntries(50)).rejects.toThrow(
        "PAYMENT_LEDGER_INTEGRITY_MISMATCH",
      );
    } finally {
      database.close();
    }
  });

  it("rejects an existing RevenueRecorded event whose payload differs from its ledger row", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      database.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      );
      database.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      );
      database.exec(
        "CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_refund_id TEXT NOT NULL, status TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      insertPayment(
        database,
        "payment-projection",
        "order-projection",
        "COP",
        "ledger-projection",
        10000,
      );
      insertAnalyticsEvent(database, "revenue:ledger-projection", "RevenueRecorded", "server", {
        ledgerId: "ledger-projection",
        paymentId: "payment-projection",
        orderId: "order-projection",
        entryType: "PAYMENT_CONFIRMED",
        revenueDirection: "CREDIT",
        amountInCents: 9000,
        netAmountInCents: 9000,
        currency: "COP",
      });

      const repository = new D1RevenueAnalyticsRepository(database.asD1());
      await expect(repository.pendingRevenueEntries(50)).rejects.toThrow(
        "PAYMENT_LEDGER_INTEGRITY_MISMATCH",
      );
    } finally {
      database.close();
    }
  });
});
