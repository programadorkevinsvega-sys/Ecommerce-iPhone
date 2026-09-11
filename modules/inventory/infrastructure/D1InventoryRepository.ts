import type { D1Database } from "@cloudflare/workers-types";
import type { InventoryRepository } from "../application/AdminInventory";

export class D1InventoryRepository implements InventoryRepository {
  constructor(private readonly db: D1Database) {}
  async findAdjustment(idempotencyKey: string) { return this.db.prepare("SELECT id,product_id AS productId,delta,reason,created_at AS createdAt FROM inventory_adjustments WHERE idempotency_key=? LIMIT 1").bind(idempotencyKey).first(); }
  async findProduct(productId: string) { return this.db.prepare("SELECT id,name,stock FROM products WHERE id=? LIMIT 1").bind(productId).first<{ id: string; name: string; stock: number }>(); }
  async adjustStock(productId: string, delta: number, adminUserId: string, reason: string, idempotencyKey: string) {
    const id = crypto.randomUUID();
    const product = this.db.prepare("UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock+?>=0").bind(delta, productId, delta);
    const adjustment = this.db.prepare("INSERT INTO inventory_adjustments(id,product_id,admin_user_id,delta,reason,idempotency_key) VALUES(?,?,?,?,?,?)").bind(id, productId, adminUserId, delta, reason, idempotencyKey);
    const results = await this.db.batch([product, adjustment]);
    if (results[0]?.meta.changes !== 1) throw new Error("INSUFFICIENT_STOCK_OR_PRODUCT_NOT_FOUND");
    if (results[1]?.meta.changes !== 1) throw new Error("INVENTORY_ADJUSTMENT_NOT_RECORDED");
    const updated = await this.findProduct(productId);
    if (!updated) throw new Error("PRODUCT_NOT_FOUND");
    return { id, productId, delta, stock: updated.stock };
  }
  async listAdjustments(productId?: string, limit = 50, offset = 0) {
    if (productId) return (await this.db.prepare("SELECT id,product_id AS productId,admin_user_id AS adminUserId,delta,reason,idempotency_key AS idempotencyKey,created_at AS createdAt FROM inventory_adjustments WHERE product_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(productId, limit, offset).all()).results;
    return (await this.db.prepare("SELECT id,product_id AS productId,admin_user_id AS adminUserId,delta,reason,idempotency_key AS idempotencyKey,created_at AS createdAt FROM inventory_adjustments ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all()).results;
  }
}
