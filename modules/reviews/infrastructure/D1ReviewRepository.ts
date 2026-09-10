import type { D1Database } from "@cloudflare/workers-types";
import type { ReviewRepository, PublicReview } from "../application/ReviewRepository";
import type { Review } from "../domain/Review";

type Row={id:string;customer_id:string;customer_name:string;rating:number;title:string|null;body:string;status:"PENDING"|"APPROVED"|"REJECTED";verified_purchase:number;admin_response:string|null};
export class D1ReviewRepository implements ReviewRepository {
  constructor(private readonly db:D1Database) {}
  async listApproved(productId:string):Promise<readonly PublicReview[]> {
    const r=await this.db.prepare("SELECT r.id,r.customer_id,trim(c.first_name||' '||c.last_name) customer_name,r.rating,r.title,r.body,r.status,r.verified_purchase,r.admin_response FROM product_reviews r JOIN customers c ON c.id=r.customer_id WHERE r.product_id=? AND r.status='APPROVED' ORDER BY r.created_at DESC").bind(productId).all<Row>();
    return r.results.map(x=>({
      id:x.id,productId,customerId:x.customer_id,orderId:"",rating:x.rating,body:x.body,status:x.status,
      verifiedPurchase:x.verified_purchase===1,customerName:x.customer_name,
      ...(x.title!==null?{title:x.title}:{}),
      ...(x.admin_response!==null?{adminResponse:x.admin_response}:{}),
    }));
  }
  async hasVerifiedPurchase(customerId:string,productId:string,orderId:string){const r=await this.db.prepare("SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.id=? AND o.customer_id=? AND oi.product_id=? AND o.status='DELIVERED' LIMIT 1").bind(orderId,customerId,productId).first();return !!r;}
  async exists(customerId:string,productId:string,orderId:string){const r=await this.db.prepare("SELECT 1 FROM product_reviews WHERE customer_id=? AND product_id=? AND order_id=? LIMIT 1").bind(customerId,productId,orderId).first();return !!r;}
  async create(review:Review){const p=review.toPrimitives();await this.db.prepare("INSERT INTO product_reviews(id,product_id,customer_id,order_id,rating,title,body,status,verified_purchase,admin_response) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(p.id,p.productId,p.customerId,p.orderId,p.rating,p.title??null,p.body,p.status,p.verifiedPurchase?1:0,p.adminResponse??null).run();}
}
