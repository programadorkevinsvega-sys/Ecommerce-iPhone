import type { D1Database } from "@cloudflare/workers-types";
import type { ReservationRepository } from "../application/ReservationRepository";

const HOLD_STATUSES = ["PENDING_PAYMENT", "PAYMENT_PROCESSING"] as const;

export class D1ReservationRepository implements ReservationRepository {
  constructor(private readonly db: D1Database) {}

  async releaseExpired(): Promise<number> {
    const rows = await this.db.prepare(
      "SELECT ir.id,ir.product_id,ir.quantity,o.status FROM inventory_reservations ir LEFT JOIN orders o ON o.id=ir.order_id WHERE ir.released_at IS NULL AND ir.expires_at<=CURRENT_TIMESTAMP",
    ).all<{ id: string; product_id: string; quantity: number; status: string | null }>();
    let released = 0;
    for (const row of rows.results) {
      if (row.status && HOLD_STATUSES.includes(row.status as (typeof HOLD_STATUSES)[number])) {
        const result = await this.db.batch([
          this.db.prepare("UPDATE inventory_reservations SET released_at=CURRENT_TIMESTAMP WHERE id=? AND released_at IS NULL AND expires_at<=CURRENT_TIMESTAMP AND EXISTS (SELECT 1 FROM orders WHERE id=inventory_reservations.order_id AND status IN ('PENDING_PAYMENT','PAYMENT_PROCESSING'))").bind(row.id),
          this.db.prepare("UPDATE products SET stock=stock+? WHERE id=? AND changes()=1").bind(row.quantity, row.product_id),
        ]);
        if (result[0]?.meta.changes === 1) released += 1;
      } else {
        // Paid/processing/finalized orders must never return sold stock.
        const result = await this.db.prepare("UPDATE inventory_reservations SET released_at=CURRENT_TIMESTAMP WHERE id=? AND released_at IS NULL").bind(row.id).run();
        if (result.meta.changes === 1) released += 1;
      }
    }
    return released;
  }

  async releaseForOrder(orderId: string): Promise<number> {
    const rows = await this.db.prepare("SELECT id,product_id,quantity FROM inventory_reservations WHERE order_id=? AND released_at IS NULL").bind(orderId).all<{ id: string; product_id: string; quantity: number }>();
    let released = 0;
    for (const row of rows.results) {
      const result = await this.db.batch([
        this.db.prepare("UPDATE inventory_reservations SET released_at=CURRENT_TIMESTAMP WHERE id=? AND released_at IS NULL").bind(row.id),
        this.db.prepare("UPDATE products SET stock=stock+? WHERE id=? AND changes()=1").bind(row.quantity, row.product_id),
      ]);
      if (result[0]?.meta.changes === 1) released += 1;
    }
    return released;
  }

  async consumeForOrder(orderId: string): Promise<number> {
    const result = await this.db.prepare("UPDATE inventory_reservations SET released_at=CURRENT_TIMESTAMP WHERE order_id=? AND released_at IS NULL").bind(orderId).run();
    return result.meta.changes;
  }
}
