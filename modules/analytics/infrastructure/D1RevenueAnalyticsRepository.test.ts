import { describe, expect, it } from "vitest";
import { D1RevenueAnalyticsRepository } from "./D1RevenueAnalyticsRepository";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";

describe("D1RevenueAnalyticsRepository", () => {
  it("derives funnel counts from orders and the payment ledger, not client analytics events", async () => {
    const database = new D1SqliteTestDatabase();

    try {
      database.exec("ALTER TABLE orders ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
      database.exec(
        "CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, customer_id TEXT NOT NULL)",
      );
      database.exec(
        "CREATE TABLE payment_ledger (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, entry_type TEXT NOT NULL, amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL)",
      );

      database.exec(
        "INSERT INTO orders (id, order_number, customer_id, email, status, currency, subtotal_in_cents, shipping_in_cents, discount_in_cents, total_in_cents, shipping_method, shipping_recipient_name, shipping_phone, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "order-1",
        "ORD-1",
        "customer-1",
        "customer@example.test",
        "PAID",
        "COP",
        10000,
        0,
        0,
        10000,
        "PICKUP",
        "Test Customer",
        "3000000000",
        "Test Street",
        null,
        "Medellin",
        "Antioquia",
        null,
        "CO",
        "2026-09-15T12:00:00.000Z",
      );
      database.exec(
        "INSERT INTO payments (id, order_id, customer_id) VALUES (?, ?, ?)",
        "payment-1",
        "order-1",
        "customer-1",
      );
      database.exec(
        "INSERT INTO payment_ledger (id, payment_id, entry_type, amount_in_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        "ledger-sale-1",
        "payment-1",
        "PAYMENT_CONFIRMED",
        10000,
        "COP",
        "2026-09-15T12:01:00.000Z",
      );
      database.exec(
        "INSERT INTO payment_ledger (id, payment_id, entry_type, amount_in_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        "ledger-refund-1",
        "payment-1",
        "PAYMENT_REFUNDED",
        2500,
        "COP",
        "2026-09-16T12:01:00.000Z",
      );

      for (const [eventId, eventType] of [
        ["forged-checkout-1", "CheckoutStarted"],
        ["forged-purchase-1", "PurchaseCompleted"],
      ]) {
        database.exec(
          "INSERT INTO analytics_events (event_id, event_type, event_version, occurred_at, received_at, session_id, visitor_id, request_id, source, payload_json, expires_at) VALUES (?, ?, 1, ?, ?, ?, ?, NULL, 'web', '{}', ?)",
          eventId,
          eventType,
          "2026-09-15T12:00:00.000Z",
          "2026-09-15T12:00:01.000Z",
          "session-12345678",
          "visitor-12345678",
          "2027-03-15T12:00:00.000Z",
        );
      }

      const repository = new D1RevenueAnalyticsRepository(database.asD1());
      const report = await repository.report(
        "2026-09-01T00:00:00.000Z",
        "2026-10-01T00:00:00.000Z",
      );

      expect(report).toMatchObject({
        grossRevenueInCents: 10000,
        refundedRevenueInCents: 2500,
        netRevenueInCents: 7500,
        confirmedPaymentCount: 1,
        refundCount: 1,
        checkoutStartedCount: 1,
        purchaseCompletedCount: 1,
        conversionRate: 1,
        currencyBreakdown: [
          {
            currency: "COP",
            grossRevenueInCents: 10000,
            refundedRevenueInCents: 2500,
            netRevenueInCents: 7500,
          },
        ],
      });
    } finally {
      database.close();
    }
  });
});
