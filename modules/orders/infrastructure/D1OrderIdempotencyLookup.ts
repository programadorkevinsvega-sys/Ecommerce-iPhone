import type { D1Database } from "@cloudflare/workers-types";
import type { OrderIdempotencyLookup } from "../application/OrderIdempotencyLookup";
import type { OrderRepository } from "../application/OrderRepository";

type CheckoutIdempotencyRow = {
  order_id: string;
};

export class D1OrderIdempotencyLookup implements OrderIdempotencyLookup {
  constructor(
    private readonly db: D1Database,
    private readonly orders: OrderRepository,
  ) {}

  async findByIdempotencyKeyForCustomer(
    key: string,
    customerId: string,
  ) {
    const row = await this.db
      .prepare(
        "SELECT order_id FROM checkout_idempotency WHERE idempotency_key=? AND customer_id=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1",
      )
      .bind(key, customerId)
      .first<CheckoutIdempotencyRow>();

    return row ? this.orders.findById(row.order_id) : null;
  }
}
