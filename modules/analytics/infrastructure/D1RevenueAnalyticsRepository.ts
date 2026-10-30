import type { D1Database } from "@cloudflare/workers-types";
import type { RevenueAnalyticsPort, RevenueLedgerEntry, RevenueReport } from "../application/RevenueAnalytics";

type LedgerRow = Readonly<{
  ledgerId: string;
  paymentId: string;
  orderId: string;
  customerId: string;
  entryType: RevenueLedgerEntry["entryType"];
  amountInCents: number;
  currency: string;
  occurredAt: string;
}>;

type AggregateRow = Readonly<{
  grossRevenueInCents: number | null;
  refundedRevenueInCents: number | null;
  confirmedPaymentCount: number;
  refundCount: number;
  checkoutStartedCount: number;
  purchaseCompletedCount: number;
}>;

type CurrencyRow = Readonly<{
  currency: string;
  grossRevenueInCents: number | null;
  refundedRevenueInCents: number | null;
}>;

export class D1RevenueAnalyticsRepository implements RevenueAnalyticsPort {
  constructor(private readonly db: D1Database) {}

  async pendingRevenueEntries(limit: number): Promise<readonly RevenueLedgerEntry[]> {
    const rows = await this.db.prepare(
      `SELECT
        pl.id AS ledgerId,
        pl.payment_id AS paymentId,
        p.order_id AS orderId,
        p.customer_id AS customerId,
        pl.entry_type AS entryType,
        pl.amount_in_cents AS amountInCents,
        pl.currency AS currency,
        pl.created_at AS occurredAt
      FROM payment_ledger pl
      INNER JOIN payments p ON p.id = pl.payment_id
      WHERE pl.entry_type IN ('PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED')
        AND NOT EXISTS (
          SELECT 1
          FROM analytics_events ae
          WHERE ae.event_id = 'revenue:' || pl.id
        )
      ORDER BY pl.created_at ASC, pl.id ASC
      LIMIT ?`,
    ).bind(limit).all<LedgerRow>();

    return rows.results;
  }

  async report(from: string, to: string): Promise<RevenueReport> {
    const [aggregate, currencies] = await Promise.all([
      this.db.prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN pl.entry_type='PAYMENT_CONFIRMED' THEN pl.amount_in_cents ELSE 0 END), 0) AS grossRevenueInCents,
          COALESCE(SUM(CASE WHEN pl.entry_type='PAYMENT_REFUNDED' THEN pl.amount_in_cents ELSE 0 END), 0) AS refundedRevenueInCents,
          COUNT(DISTINCT CASE WHEN pl.entry_type='PAYMENT_CONFIRMED' THEN pl.payment_id END) AS confirmedPaymentCount,
          COUNT(CASE WHEN pl.entry_type='PAYMENT_REFUNDED' THEN 1 END) AS refundCount,
          (
            SELECT COUNT(*)
            FROM orders
            WHERE created_at >= ?
              AND created_at < ?
          ) AS checkoutStartedCount,
          COUNT(DISTINCT CASE WHEN pl.entry_type='PAYMENT_CONFIRMED' THEN pl.payment_id END) AS purchaseCompletedCount
        FROM payment_ledger pl
        WHERE pl.entry_type IN ('PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED')
          AND pl.created_at >= ?
          AND pl.created_at < ?`,
      ).bind(from, to, from, to).first<AggregateRow>(),
      this.db.prepare(
        `SELECT
          pl.currency AS currency,
          COALESCE(SUM(CASE WHEN pl.entry_type='PAYMENT_CONFIRMED' THEN pl.amount_in_cents ELSE 0 END), 0) AS grossRevenueInCents,
          COALESCE(SUM(CASE WHEN pl.entry_type='PAYMENT_REFUNDED' THEN pl.amount_in_cents ELSE 0 END), 0) AS refundedRevenueInCents
        FROM payment_ledger pl
        WHERE pl.entry_type IN ('PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED')
          AND pl.created_at >= ?
          AND pl.created_at < ?
        GROUP BY pl.currency
        ORDER BY pl.currency ASC`,
      ).bind(from, to).all<CurrencyRow>(),
    ]);

    const grossRevenueInCents = Number(aggregate?.grossRevenueInCents ?? 0);
    const refundedRevenueInCents = Number(aggregate?.refundedRevenueInCents ?? 0);
    const checkoutStartedCount = Number(aggregate?.checkoutStartedCount ?? 0);
    const purchaseCompletedCount = Number(aggregate?.purchaseCompletedCount ?? 0);

    return {
      period: { from, to },
      grossRevenueInCents,
      refundedRevenueInCents,
      netRevenueInCents: grossRevenueInCents - refundedRevenueInCents,
      confirmedPaymentCount: Number(aggregate?.confirmedPaymentCount ?? 0),
      refundCount: Number(aggregate?.refundCount ?? 0),
      checkoutStartedCount,
      purchaseCompletedCount,
      conversionRate: checkoutStartedCount === 0
        ? 0
        : Number((purchaseCompletedCount / checkoutStartedCount).toFixed(6)),
      currencyBreakdown: currencies.results.map((row) => {
        const gross = Number(row.grossRevenueInCents ?? 0);
        const refunded = Number(row.refundedRevenueInCents ?? 0);
        return {
          currency: row.currency,
          grossRevenueInCents: gross,
          refundedRevenueInCents: refunded,
          netRevenueInCents: gross - refunded,
        };
      }),
    };
  }
}
