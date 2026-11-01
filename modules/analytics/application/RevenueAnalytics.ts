import type { AnalyticsService } from "./AnalyticsService";

export type RevenueLedgerEntry = Readonly<{
  ledgerId: string;
  paymentId: string;
  orderId: string;
  customerId: string;
  entryType: "PAYMENT_CONFIRMED" | "PAYMENT_REFUNDED";
  amountInCents: number;
  currency: string;
  occurredAt: string;
}>;

export type RevenueCurrencyBreakdown = Readonly<{
  currency: string;
  grossRevenueInCents: number;
  refundedRevenueInCents: number;
  netRevenueInCents: number;
  confirmedPaymentCount: number;
  refundCount: number;
}>;

export type RevenueReport = Readonly<{
  period: Readonly<{ from: string; to: string }>;
  /**
   * Top-level amounts are null when the report spans multiple currencies.
   * Consumers must render currencyBreakdown instead of summing currencies.
   */
  grossRevenueInCents: number | null;
  refundedRevenueInCents: number | null;
  netRevenueInCents: number | null;
  financialTotalsCurrency: string | null;
  confirmedPaymentCount: number;
  refundCount: number;
  checkoutStartedCount: number;
  purchaseCompletedCount: number;
  conversionRate: number;
  conversionWarning?: string;
  currencyBreakdown: readonly RevenueCurrencyBreakdown[];
}>;

export interface RevenueAnalyticsPort {
  pendingRevenueEntries(limit: number): Promise<readonly RevenueLedgerEntry[]>;
  report(from: string, to: string): Promise<RevenueReport>;
}

function assertPeriod(from: string, to: string): void {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error("INVALID_REVENUE_PERIOD");
  }
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new Error("REVENUE_PERIOD_TOO_LARGE");
  }
}

export class RevenueAnalyticsService {
  constructor(
    private readonly source: RevenueAnalyticsPort,
    private readonly analytics: AnalyticsService,
  ) {}

  async reconcile(limit = 200): Promise<number> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.trunc(limit), 500))
      : 200;
    const entries = await this.source.pendingRevenueEntries(boundedLimit);

    for (const entry of entries) {
      const direction = entry.entryType === "PAYMENT_REFUNDED" ? "DEBIT" : "CREDIT";
      await this.analytics.record({
        eventId: `revenue:${entry.ledgerId}`,
        eventType: "RevenueRecorded",
        occurredAt: entry.occurredAt,
        sessionId: `order:${entry.orderId}`,
        visitorId: `customer:${entry.customerId}`,
        source: "server",
        payload: {
          ledgerId: entry.ledgerId,
          paymentId: entry.paymentId,
          orderId: entry.orderId,
          entryType: entry.entryType,
          revenueDirection: direction,
          amountInCents: entry.amountInCents,
          netAmountInCents:
            direction === "DEBIT" ? -entry.amountInCents : entry.amountInCents,
          currency: entry.currency,
        },
      });
    }

    return entries.length;
  }

  async report(from: string, to: string): Promise<RevenueReport> {
    assertPeriod(from, to);
    return this.source.report(new Date(from).toISOString(), new Date(to).toISOString());
  }
}
