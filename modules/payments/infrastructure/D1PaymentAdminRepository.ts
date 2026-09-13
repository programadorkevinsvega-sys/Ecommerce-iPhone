import type { D1Database } from "@cloudflare/workers-types";
import type { PaymentProvider, PaymentStatus } from "../domain/Payment";
import type { AdminPaymentFilter, AdminPaymentListResult, AdminPaymentSummary, PaymentAdminRepository } from "../application/AdminPaymentQuery";

export class D1PaymentAdminRepository implements PaymentAdminRepository {
  constructor(private readonly db: D1Database) {}

  async list(filter: AdminPaymentFilter): Promise<AdminPaymentListResult> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filter.status) {
      clauses.push("status = ?");
      values.push(filter.status);
    }
    if (filter.provider) {
      clauses.push("provider = ?");
      values.push(filter.provider);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = await this.db
      .prepare(`SELECT id,order_id,customer_id,provider,provider_reference,provider_transaction_id,status,amount_in_cents,currency,created_at,updated_at FROM payments${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, filter.limit, filter.offset)
      .all<PaymentSummaryRow>();
    return { items: rows.results.map(this.mapSummary), limit: filter.limit, offset: filter.offset };
  }

  async findByIdForAdmin(id: string): Promise<AdminPaymentSummary & { checkoutUrl?: string } | null> {
    const row = await this.db
      .prepare("SELECT id,order_id,customer_id,provider,provider_reference,provider_transaction_id,checkout_url,status,amount_in_cents,currency,created_at,updated_at FROM payments WHERE id=? LIMIT 1")
      .bind(id)
      .first<PaymentDetailsRow>();
    if (!row) return null;
    return { ...this.mapSummary(row), ...(row.checkout_url ? { checkoutUrl: row.checkout_url } : {}) };
  }

  private readonly mapSummary = (row: PaymentSummaryRow): AdminPaymentSummary => ({
    id: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    provider: row.provider,
    providerReference: row.provider_reference,
    ...(row.provider_transaction_id ? { providerTransactionId: row.provider_transaction_id } : {}),
    status: row.status,
    amountInCents: row.amount_in_cents,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

type PaymentSummaryRow = {
  id: string;
  order_id: string;
  customer_id: string;
  provider: PaymentProvider;
  provider_reference: string;
  provider_transaction_id: string | null;
  status: PaymentStatus;
  amount_in_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

type PaymentDetailsRow = PaymentSummaryRow & { checkout_url: string | null };
