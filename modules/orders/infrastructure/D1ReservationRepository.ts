import type { D1Database } from "@cloudflare/workers-types";
import type { ReservationRepository } from "../application/ReservationRepository";

export class D1ReservationRepository implements ReservationRepository {
  constructor(private readonly db: D1Database) {}

  async releaseExpired(): Promise<number> {
    const rows = await this.db
      .prepare("SELECT id,product_id,quantity FROM inventory_reservations WHERE released_at IS NULL AND expires_at<=CURRENT_TIMESTAMP")
      .all<{ id: string; product_id: string; quantity: number }>();
    if (!rows.results.length) return 0;
    const statements = rows.results.flatMap((row) => [
      this.db.prepare("UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.quantity, row.product_id),
      this.db.prepare("UPDATE inventory_reservations SET released_at=CURRENT_TIMESTAMP WHERE id=? AND released_at IS NULL").bind(row.id),
    ]);
    await this.db.batch(statements);
    return rows.results.length;
  }
}
