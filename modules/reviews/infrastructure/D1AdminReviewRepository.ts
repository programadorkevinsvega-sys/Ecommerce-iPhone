import type { D1Database } from "@cloudflare/workers-types";
import type { ReviewRepository } from "../application/AdminReviews";

export class D1AdminReviewRepository implements ReviewRepository {
  constructor(private readonly db: D1Database) {}
  async list(status?: string, productId?: string, limit = 50, offset = 0) {
    const clauses: string[] = []; const values: unknown[] = [];
    if (status) { clauses.push("r.status=?"); values.push(status); }
    if (productId) { clauses.push("r.product_id=?"); values.push(productId); }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return (await this.db.prepare(`SELECT r.id,r.product_id AS productId,r.customer_id AS customerId,r.order_id AS orderId,r.rating,r.title,r.body,r.status,r.verified_purchase AS verifiedPurchase,r.admin_response AS adminResponse,r.created_at AS createdAt,r.updated_at AS updatedAt,p.name AS productName FROM product_reviews r JOIN products p ON p.id=r.product_id${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).bind(...values, limit, offset).all()).results;
  }
  async moderate(id: string, status: "APPROVED" | "REJECTED", response?: string) {
    const result = await this.db.prepare("UPDATE product_reviews SET status=?,admin_response=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, response ?? null, id).run();
    if (result.meta.changes !== 1) throw new Error("REVIEW_NOT_FOUND");
    return true;
  }
}
