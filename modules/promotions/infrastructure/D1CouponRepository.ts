import type { D1Database } from "@cloudflare/workers-types";
import type { CouponRepository } from "../application/MarketingPorts";
import type { Coupon } from "../domain/Marketing";

type CouponRow={id:string;code:string;name:string;discount_type:"PERCENT"|"FIXED";discount_value:number;min_subtotal_in_cents:number;max_uses:number|null;used_count:number;max_uses_per_customer:number|null;starts_at:string;ends_at:string;active:number};

export class D1CouponRepository implements CouponRepository {
  constructor(private readonly db:D1Database) {}
  async list():Promise<readonly Coupon[]> {
    const rows=await this.db.prepare("SELECT id,code,name,discount_type,discount_value,min_subtotal_in_cents,max_uses,used_count,max_uses_per_customer,starts_at,ends_at,active FROM coupons ORDER BY created_at DESC").all<CouponRow>();
    return Promise.all(rows.results.map((row)=>this.hydrate(row)));
  }
  async findActiveByCode(code:string,customerId:string,at:string):Promise<Coupon|null> {
    const row=await this.db.prepare("SELECT id,code,name,discount_type,discount_value,min_subtotal_in_cents,max_uses,used_count,max_uses_per_customer,starts_at,ends_at,active FROM coupons WHERE code=? COLLATE NOCASE AND active=1 AND starts_at<=? AND ends_at>? AND (max_uses IS NULL OR used_count<max_uses) AND (max_uses_per_customer IS NULL OR (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id=coupons.id AND cr.customer_id=?)<max_uses_per_customer) LIMIT 1").bind(code,at,at,customerId).first<CouponRow>();
    return row?this.hydrate(row):null;
  }
  async save(input:Coupon):Promise<void> {
    const existing=this.db.prepare("SELECT id FROM coupons WHERE id=?").bind(input.id);
    const statements=[this.db.prepare("INSERT INTO coupons(id,code,name,discount_type,discount_value,min_subtotal_in_cents,max_uses,used_count,max_uses_per_customer,starts_at,ends_at,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,discount_type=excluded.discount_type,discount_value=excluded.discount_value,min_subtotal_in_cents=excluded.min_subtotal_in_cents,max_uses=excluded.max_uses,max_uses_per_customer=excluded.max_uses_per_customer,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,updated_at=CURRENT_TIMESTAMP").bind(input.id,input.code,input.name,input.discountType,input.discountValue,input.minSubtotalInCents,input.maxUses,input.usedCount,input.maxUsesPerCustomer,input.startsAt,input.endsAt,input.active?1:0),this.db.prepare("DELETE FROM coupon_products WHERE coupon_id=?").bind(input.id),this.db.prepare("DELETE FROM coupon_categories WHERE coupon_id=?").bind(input.id),...input.productIds.map(id=>this.db.prepare("INSERT INTO coupon_products(coupon_id,product_id) VALUES(?,?)").bind(input.id,id)),...input.categoryIds.map(id=>this.db.prepare("INSERT INTO coupon_categories(coupon_id,category_id) VALUES(?,?)").bind(input.id,id))];
    await existing.first();
    await this.db.batch(statements);
  }
  async redeem(input:{couponId:string;customerId:string;orderId:string;amountInCents:number}):Promise<void> {
    const result=await this.db.batch([
      this.db.prepare("UPDATE coupons SET used_count=used_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1 AND starts_at<=CURRENT_TIMESTAMP AND ends_at>CURRENT_TIMESTAMP AND (max_uses IS NULL OR used_count<max_uses) AND (max_uses_per_customer IS NULL OR (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=? AND customer_id=?)<max_uses_per_customer)").bind(input.couponId,input.couponId,input.customerId),
      this.db.prepare("INSERT INTO coupon_redemptions(id,coupon_id,customer_id,order_id,amount_in_cents) SELECT ?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),input.couponId,input.customerId,input.orderId,input.amountInCents),
    ]);
    if(result[0]?.meta.changes!==1 || result[1]?.meta.changes!==1) throw new Error("COUPON_REDEMPTION_CONFLICT");
  }
  private async hydrate(row:CouponRow):Promise<Coupon> {
    const [products,categories]=await Promise.all([
      this.db.prepare("SELECT product_id FROM coupon_products WHERE coupon_id=? ORDER BY product_id").bind(row.id).all<{product_id:string}>(),
      this.db.prepare("SELECT category_id FROM coupon_categories WHERE coupon_id=? ORDER BY category_id").bind(row.id).all<{category_id:string}>(),
    ]);
    return {id:row.id,code:row.code,name:row.name,discountType:row.discount_type,discountValue:row.discount_value,minSubtotalInCents:row.min_subtotal_in_cents,maxUses:row.max_uses,usedCount:row.used_count,maxUsesPerCustomer:row.max_uses_per_customer,startsAt:row.starts_at,endsAt:row.ends_at,active:row.active===1,productIds:products.results.map(x=>x.product_id),categoryIds:categories.results.map(x=>x.category_id)};
  }
}
