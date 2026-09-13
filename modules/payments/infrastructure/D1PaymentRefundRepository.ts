import type { D1Database } from "@cloudflare/workers-types";
import type { PaymentRefundRepository } from "../application/AdminPaymentQuery";

export class D1PaymentRefundRepository implements PaymentRefundRepository {
  constructor(private readonly db: D1Database) {}

  async listByPaymentId(paymentId: string): Promise<readonly unknown[]> {
    const rows = await this.db
      .prepare("SELECT id,provider_refund_id,status,amount_in_cents,currency,created_at,updated_at FROM payment_refunds WHERE payment_id=? ORDER BY created_at DESC")
      .bind(paymentId)
      .all();
    return rows.results;
  }
}
