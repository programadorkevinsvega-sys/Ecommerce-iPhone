import type { D1Database } from "@cloudflare/workers-types";
import type { PaymentLedgerRepository } from "../application/AdminPaymentQuery";

export class D1PaymentLedgerRepository implements PaymentLedgerRepository {
  constructor(private readonly db: D1Database) {}

  async listByPaymentId(paymentId: string): Promise<readonly unknown[]> {
    const rows = await this.db
      .prepare("SELECT id,entry_type,amount_in_cents,currency,metadata_json,created_at FROM payment_ledger WHERE payment_id=? ORDER BY created_at DESC")
      .bind(paymentId)
      .all();
    return rows.results;
  }
}
