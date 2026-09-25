import type { D1Database } from "@cloudflare/workers-types";
import type { PromotionRepository } from "../application/AdminPromotions";
import type { Promotion } from "../domain/Marketing";

type PromotionRow = Omit<Promotion, "productIds" | "categoryIds" | "active"> & { active: number };

export class D1PromotionRepository implements PromotionRepository {
 constructor(private readonly db:D1Database){}
 async list():Promise<readonly Promotion[]>{
  const rows=await this.db.prepare("SELECT id,code,name,discount_type AS discountType,discount_value AS discountValue,min_subtotal_in_cents AS minSubtotalInCents,max_uses AS maxUses,used_count AS usedCount,starts_at AS startsAt,ends_at AS endsAt,active FROM promotions ORDER BY created_at DESC").all<PromotionRow>();
  return Promise.all(rows.results.map(async r=>{
   const products=await this.db.prepare("SELECT product_id FROM promotion_products WHERE promotion_id=? ORDER BY product_id").bind(r.id).all<{product_id:string}>();
   const categories=await this.db.prepare("SELECT category_id FROM promotion_categories WHERE promotion_id=? ORDER BY category_id").bind(r.id).all<{category_id:string}>();
   return {
    id:r.id, code:r.code, name:r.name, discountType:r.discountType, discountValue:r.discountValue,
    minSubtotalInCents:r.minSubtotalInCents, maxUses:r.maxUses, usedCount:r.usedCount,
    startsAt:r.startsAt, endsAt:r.endsAt, active:r.active===1,
    productIds:products.results.map(x=>x.product_id), categoryIds:categories.results.map(x=>x.category_id)
   };
  }));
 }
 async save(input:Promotion):Promise<string>{
  const result=await this.db.batch([
   this.db.prepare("INSERT INTO promotions(id,code,name,discount_type,discount_value,min_subtotal_in_cents,max_uses,used_count,starts_at,ends_at,active) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,discount_type=excluded.discount_type,discount_value=excluded.discount_value,min_subtotal_in_cents=excluded.min_subtotal_in_cents,max_uses=excluded.max_uses,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,updated_at=CURRENT_TIMESTAMP").bind(input.id,input.code,input.name,input.discountType,input.discountValue,input.minSubtotalInCents,input.maxUses,input.usedCount,input.startsAt,input.endsAt,input.active?1:0),
   this.db.prepare("DELETE FROM promotion_products WHERE promotion_id=?").bind(input.id),
   this.db.prepare("DELETE FROM promotion_categories WHERE promotion_id=?").bind(input.id),
   ...input.productIds.map(id=>this.db.prepare("INSERT INTO promotion_products(promotion_id,product_id) VALUES(?,?)").bind(input.id,id)),
   ...input.categoryIds.map(id=>this.db.prepare("INSERT INTO promotion_categories(promotion_id,category_id) VALUES(?,?)").bind(input.id,id)),
  ]);
  if(result[0]?.meta.changes!==1)throw new Error("PROMOTION_NOT_SAVED"); return input.id;
 }
 async setActive(id:string,active:boolean):Promise<boolean>{
  const result=await this.db.prepare("UPDATE promotions SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(active?1:0,id).run();
  if(result.meta.changes!==1)throw new Error("PROMOTION_NOT_FOUND"); return true;
 }
}
