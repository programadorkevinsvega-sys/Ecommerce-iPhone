import type { D1Database } from "@cloudflare/workers-types";
import type { ReviewModerationStatus } from "../domain/ReviewModeration";
import type { AdminReview, ReviewRepository } from "../application/AdminReviews";

export class D1AdminReviewRepository implements ReviewRepository {
  constructor(private readonly db:D1Database) {}

  async list(status?:string,productId?:string,limit=50,offset=0):Promise<readonly AdminReview[]> {
    const clauses:string[]=[]; const values:Array<string|number>=[];
    if(status){clauses.push("r.status=?");values.push(status);}
    if(productId){clauses.push("r.product_id=?");values.push(productId);}
    const where=clauses.length?" WHERE "+clauses.join(" AND "):"";
    const sql="SELECT r.id,r.product_id AS productId,r.customer_id AS customerId,r.order_id AS orderId,r.rating,r.title,r.body,r.status,r.verified_purchase AS verifiedPurchase,r.admin_response AS adminResponse,r.created_at AS createdAt,r.updated_at AS updatedAt,p.name AS productName FROM product_reviews r JOIN products p ON p.id=r.product_id"+where+" ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
    const result=await this.db.prepare(sql).bind(...values,limit,offset).all<AdminReview>();
    return result.results;
  }

  async getStatus(id:string):Promise<ReviewModerationStatus|null> {
    const row=await this.db.prepare("SELECT status FROM product_reviews WHERE id=?").bind(id).first<{status:ReviewModerationStatus}>();
    return row?.status??null;
  }

  async moderate(id:string,from:ReviewModerationStatus,status:ReviewModerationStatus,response?:string):Promise<boolean> {
    const result=await this.db.prepare("UPDATE product_reviews SET status=?,admin_response=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(status,response??null,id,from).run();
    return result.meta.changes===1;
  }
}
