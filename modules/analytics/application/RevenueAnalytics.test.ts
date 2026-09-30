import { describe, expect, it, vi } from "vitest";
import type { AnalyticsService } from "./AnalyticsService";
import { RevenueAnalyticsService, type RevenueAnalyticsPort } from "./RevenueAnalytics";

describe("RevenueAnalyticsService", () => {
  it("publishes one RevenueRecorded event per canonical payment ledger entry", async () => {
    const source: RevenueAnalyticsPort = {
      pendingRevenueEntries: vi.fn().mockResolvedValue([
        {
          ledgerId: "ledger-sale-12345678",
          paymentId: "payment-12345678",
          orderId: "order-12345678",
          customerId: "customer-12345678",
          entryType: "PAYMENT_CONFIRMED",
          amountInCents: 250000,
          currency: "COP",
          occurredAt: "2026-09-29T00:00:00.000Z",
        },
        {
          ledgerId: "ledger-refund-12345678",
          paymentId: "payment-12345678",
          orderId: "order-12345678",
          customerId: "customer-12345678",
          entryType: "PAYMENT_REFUNDED",
          amountInCents: 250000,
          currency: "COP",
          occurredAt: "2026-09-29T01:00:00.000Z",
        },
      ]),
      report: vi.fn(),
    };
    const record = vi.fn();
    const analytics = { record } as unknown as AnalyticsService;
    const service = new RevenueAnalyticsService(source, analytics);

    await expect(service.reconcile()).resolves.toBe(2);

    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenNthCalledWith(1, expect.objectContaining({
      eventId: "revenue:ledger-sale-12345678",
      eventType: "RevenueRecorded",
      source: "server",
    }));
    expect(record).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventId: "revenue:ledger-refund-12345678",
      eventType: "RevenueRecorded",
      source: "server",
    }));
  });

  it("returns the canonical period report", async () => {
    const source: RevenueAnalyticsPort = {
      pendingRevenueEntries: vi.fn(),
      report: vi.fn().mockResolvedValue({
        period: { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
        grossRevenueInCents: 300000,
        refundedRevenueInCents: 50000,
        netRevenueInCents: 250000,
        confirmedPaymentCount: 3,
        refundCount: 1,
        checkoutStartedCount: 10,
        purchaseCompletedCount: 2,
        conversionRate: 0.2,
        currencyBreakdown: [{
          currency: "COP",
          grossRevenueInCents: 300000,
          refundedRevenueInCents: 50000,
          netRevenueInCents: 250000,
        }],
      }),
    };
    const service = new RevenueAnalyticsService(source, {} as AnalyticsService);

    await expect(service.report("2026-09-01", "2026-10-01")).resolves.toMatchObject({
      grossRevenueInCents: 300000,
      refundedRevenueInCents: 50000,
      netRevenueInCents: 250000,
      conversionRate: 0.2,
    });
  });

  it("rejects invalid or oversized reporting periods", async () => {
    const source: RevenueAnalyticsPort = {
      pendingRevenueEntries: vi.fn(),
      report: vi.fn(),
    };
    const service = new RevenueAnalyticsService(source, {} as AnalyticsService);

    await expect(service.report("2026-09-30T00:00:00.000Z", "2026-09-29T00:00:00.000Z"))
      .rejects.toThrow("INVALID_REVENUE_PERIOD");
    await expect(service.report("2025-01-01T00:00:00.000Z", "2026-09-29T00:00:00.000Z"))
      .rejects.toThrow("REVENUE_PERIOD_TOO_LARGE");
  });
});
