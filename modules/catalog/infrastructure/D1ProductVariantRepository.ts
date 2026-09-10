import type { D1Database } from "@cloudflare/workers-types";
import type { ProductVariant, ProductVariantRepository } from "../application/ProductVariants";

type Row = { id:string; product_id:string; name:string; options_json:string; price_in_cents:number };

export class D1ProductVariantRepository implements ProductVariantRepository {
  constructor(private readonly db:D1Database) {}
  async findByProductId(productId:string):Promise<readonly ProductVariant[]> {
    const rows=await this.db.prepare("SELECT id,product_id,name,options_json,price_in_cents FROM product_variants WHERE product_id=? AND active=1 ORDER BY sort_order ASC,name ASC").bind(productId).all<Row>();
    return rows.results.map((r)=>({id:r.id,productId:r.product_id,name:r.name,options:JSON.parse(r.options_json||"{}") as Record<string,string|number>,priceInCents:r.price_in_cents}));
  }
}
