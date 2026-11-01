import type { D1Database } from "@cloudflare/workers-types";
import type {
  RevenueAnalyticsPort,
  RevenueLedgerEntry,
  RevenueReport,
  RevenueCurrencyBreakdown,
} from "../application/RevenueAnalytics";

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
  confirmedPaymentCount: number;
  refundCount: number;
}>;

type CurrencyRow = Readonly<{
  currency: string;
  grossRevenueInCents: number | null;
  refundedRevenueInCents: number | null;
  confirmedPaymentCount: number;
  refundCount: number;
}>;

type FunnelRow = Readonly<{
  checkoutStartedCount: number;
  purchaseCompletedCount: number;
}>;

export class D1RevenueAnalyticsRepository implements RevenueAnalyticsPort {
  constructor(private readonly db: D1Database) {}

  private async assertEligibleLedgerIntegrity(): Promise<void> {
    const invalid = await this.db
      .prepare(
        // Keep these integrity predicates separate: Cloudflare D1 has a lower
        // compound SELECT limit than stock SQLite, so do not combine them with UNION.
        `SELECT 1 AS invalid
         WHERE EXISTS (
           SELECT 1
           FROM payment_ledger pl
           LEFT JOIN payments p ON p.id=pl.payment_id
           LEFT JOIN orders o ON o.id=p.order_id
           WHERE pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
             AND (
               p.id IS NULL
               OR o.id IS NULL
               OR pl.currency<>p.currency
               OR p.currency<>o.currency
               OR p.amount_in_cents<>o.total_in_cents
               OR (pl.entry_type='PAYMENT_CONFIRMED' AND (
                 pl.amount_in_cents<>p.amount_in_cents
                 OR p.status NOT IN ('PAID','REFUNDED')
                 OR o.status NOT IN (
                   'PAID','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED','CANCELLED',
                   'REFUND_PENDING','REFUNDED'
                 )
               ))
               OR (pl.entry_type='PAYMENT_REFUNDED' AND (
                 pl.amount_in_cents<>p.amount_in_cents
                 OR p.status<>'REFUNDED'
                 OR o.status<>'REFUNDED'
                 OR NOT EXISTS (
                   SELECT 1 FROM payment_ledger confirmed
                   WHERE confirmed.payment_id=pl.payment_id
                     AND confirmed.entry_type='PAYMENT_CONFIRMED'
                 )
                 OR NOT EXISTS (
                   SELECT 1 FROM payment_refunds pr
                   WHERE pr.payment_id=pl.payment_id
                     AND pr.status='SUCCEEDED'
                     AND pr.amount_in_cents=pl.amount_in_cents
                     AND pr.currency=pl.currency
                     AND pr.provider_refund_id=json_extract(pl.metadata_json,'$.providerRefundId')
                 )
                 OR COALESCE((
                   SELECT SUM(refund.amount_in_cents)
                   FROM payment_ledger refund
                   WHERE refund.payment_id=pl.payment_id
                     AND refund.entry_type='PAYMENT_REFUNDED'
                 ),0)<>p.amount_in_cents
               ))
             )
         )
         OR EXISTS (
           SELECT 1
           FROM analytics_events ae
           WHERE ae.event_type='RevenueRecorded'
             AND (
               ae.source<>'server'
               OR NOT EXISTS (
                 SELECT 1
                 FROM payment_ledger pl
                 WHERE ae.event_id='revenue:' || pl.id
                   AND pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
                   AND json_extract(ae.payload_json,'$.ledgerId') IS pl.id
                   AND json_extract(ae.payload_json,'$.paymentId') IS pl.payment_id
                   AND json_extract(ae.payload_json,'$.entryType') IS pl.entry_type
                   AND json_extract(ae.payload_json,'$.orderId') IS (
                     SELECT p.order_id FROM payments p WHERE p.id=pl.payment_id
                   )
                   AND json_extract(ae.payload_json,'$.amountInCents') IS pl.amount_in_cents
                   AND json_extract(ae.payload_json,'$.currency') IS pl.currency
                   AND json_extract(ae.payload_json,'$.revenueDirection') IS
                     CASE WHEN pl.entry_type='PAYMENT_REFUNDED' THEN 'DEBIT' ELSE 'CREDIT' END
                   AND json_extract(ae.payload_json,'$.netAmountInCents') IS
                     CASE WHEN pl.entry_type='PAYMENT_REFUNDED' THEN -pl.amount_in_cents ELSE pl.amount_in_cents END
               )
             )
         )
         OR EXISTS (
           SELECT 1
           FROM payment_ledger pl
           WHERE pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
           GROUP BY pl.payment_id,pl.entry_type
           HAVING COUNT(*)>1
         )
         OR EXISTS (
           SELECT 1
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
             )
         )
         OR EXISTS (
           SELECT 1
           FROM payments p
           LEFT JOIN payment_ledger confirmed
             ON confirmed.payment_id=p.id AND confirmed.entry_type='PAYMENT_CONFIRMED'
           WHERE p.status IN ('PAID','REFUNDED')
             AND p.updated_at<=datetime('now','-5 minutes')
             AND confirmed.id IS NULL
         )
         OR EXISTS (
           SELECT 1
           FROM payments p
           WHERE p.status='REFUNDED'
             AND NOT EXISTS (
               SELECT 1 FROM payment_refund_locks active_lock
               WHERE active_lock.payment_id=p.id
             )
             AND COALESCE((
               SELECT SUM(refund.amount_in_cents)
               FROM payment_ledger refund
               WHERE refund.payment_id=p.id
                 AND refund.entry_type='PAYMENT_REFUNDED'
             ),0)<>p.amount_in_cents
         )
         LIMIT 1`,
      )
      .first<{ invalid: number }>();

    if (invalid) throw new Error("PAYMENT_LEDGER_INTEGRITY_MISMATCH");
  }

  async pendingRevenueEntries(limit: number): Promise<readonly RevenueLedgerEntry[]> {
    await this.assertEligibleLedgerIntegrity();

    const rows = await this.db
      .prepare(
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
        INNER JOIN payments p ON p.id=pl.payment_id
        WHERE pl.entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
          AND NOT EXISTS (
            SELECT 1
            FROM analytics_events ae
            WHERE ae.event_id='revenue:' || pl.id
          )
        ORDER BY pl.created_at ASC,pl.id ASC
        LIMIT ?`,
      )
      .bind(limit)
      .all<LedgerRow>();

    return rows.results;
  }

  async report(from: string, to: string): Promise<RevenueReport> {
    await this.assertEligibleLedgerIntegrity();
    const [aggregate, currencies, funnel] = await Promise.all([
      this.db
        .prepare(
          `SELECT
            COUNT(DISTINCT CASE WHEN entry_type='PAYMENT_CONFIRMED' THEN payment_id END) AS confirmedPaymentCount,
            COUNT(CASE WHEN entry_type='PAYMENT_REFUNDED' THEN 1 END) AS refundCount
          FROM payment_ledger
          WHERE entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
            AND julianday(created_at)>=julianday(?)
            AND julianday(created_at)<julianday(?)`,
        )
        .bind(from, to)
        .first<AggregateRow>(),
      this.db
        .prepare(
          `SELECT
            currency,
            COALESCE(SUM(CASE WHEN entry_type='PAYMENT_CONFIRMED' THEN amount_in_cents ELSE 0 END),0) AS grossRevenueInCents,
            COALESCE(SUM(CASE WHEN entry_type='PAYMENT_REFUNDED' THEN amount_in_cents ELSE 0 END),0) AS refundedRevenueInCents,
            COUNT(DISTINCT CASE WHEN entry_type='PAYMENT_CONFIRMED' THEN payment_id END) AS confirmedPaymentCount,
            COUNT(CASE WHEN entry_type='PAYMENT_REFUNDED' THEN 1 END) AS refundCount
          FROM payment_ledger
          WHERE entry_type IN ('PAYMENT_CONFIRMED','PAYMENT_REFUNDED')
            AND julianday(created_at)>=julianday(?)
            AND julianday(created_at)<julianday(?)
          GROUP BY currency
          ORDER BY currency ASC`,
        )
        .bind(from, to)
        .all<CurrencyRow>(),
      this.db
        .prepare(
          `SELECT
            COUNT(DISTINCT CASE
              WHEN event_type='CheckoutStarted' THEN json_extract(payload_json,'$.orderId')
            END) AS checkoutStartedCount,
            COUNT(DISTINCT CASE
              WHEN event_type='PurchaseCompleted' THEN json_extract(payload_json,'$.paymentId')
            END) AS purchaseCompletedCount
          FROM analytics_events
          WHERE source='server'
            AND event_type IN ('CheckoutStarted','PurchaseCompleted')
            AND occurred_at>=? AND occurred_at<?`,
        )
        .bind(from, to)
        .first<FunnelRow>(),
    ]);

    const currencyBreakdown: RevenueCurrencyBreakdown[] = currencies.results.map((row) => {
      const gross = Number(row.grossRevenueInCents ?? 0);
      const refunded = Number(row.refundedRevenueInCents ?? 0);
      return {
        currency: row.currency,
        grossRevenueInCents: gross,
        refundedRevenueInCents: refunded,
        netRevenueInCents: gross - refunded,
        confirmedPaymentCount: Number(row.confirmedPaymentCount ?? 0),
        refundCount: Number(row.refundCount ?? 0),
      };
    });

    const singleCurrency = currencyBreakdown.length === 1 ? currencyBreakdown[0] : undefined;
    const hasAtMostOneCurrency = currencyBreakdown.length <= 1;
    const checkoutStartedCount = Number(funnel?.checkoutStartedCount ?? 0);
    const purchaseCompletedCount = Number(funnel?.purchaseCompletedCount ?? 0);

    return {
      period: { from, to },
      grossRevenueInCents: hasAtMostOneCurrency ? (singleCurrency?.grossRevenueInCents ?? 0) : null,
      refundedRevenueInCents: hasAtMostOneCurrency
        ? (singleCurrency?.refundedRevenueInCents ?? 0)
        : null,
      netRevenueInCents: hasAtMostOneCurrency ? (singleCurrency?.netRevenueInCents ?? 0) : null,
      financialTotalsCurrency: singleCurrency?.currency ?? null,
      confirmedPaymentCount: Number(aggregate?.confirmedPaymentCount ?? 0),
      refundCount: Number(aggregate?.refundCount ?? 0),
      checkoutStartedCount,
      purchaseCompletedCount,
      conversionRate:
        checkoutStartedCount === 0
          ? 0
          : Number((purchaseCompletedCount / checkoutStartedCount).toFixed(6)),
      ...(purchaseCompletedCount > checkoutStartedCount
        ? {
            conversionWarning:
              "PurchaseCompleted supera CheckoutStarted dentro del período; puede incluir pagos de checkouts iniciados antes del período. Revise cohortes antes de interpretar la tasa.",
          }
        : {}),
      currencyBreakdown,
    };
  }
}
