import type { D1Database } from "@cloudflare/workers-types";
import { assertCartQuantity,type Cart } from "../domain/Cart";
export class D1CartRepository{
 constructor(private readonly db:D1Database){}
 async getOrCreate(cartId:string,customerId?:string):Promise<Cart>{
  await this.db.prepare("INSERT OR IGNORE INTO carts(id,customer_id) VALUES(?,?)").bind(cartId,customerId??null).run();
  const row=await this.db.prepare("SELECT currency,customer_id FROM carts WHERE id=?").bind(cartId).first<any>();if(!row)throw new Error("Cart not found");
  const result=await this.db.prepare("SELECT ci.product_id,p.name,p.slug,ci.quantity,ci.unit_price_in_cents,p.currency,p.stock,ci.variant_id,pv.name variant_name FROM cart_items ci JOIN products p ON p.id=ci.product_id LEFT JOIN product_variants pv ON pv.id=ci.variant_id WHERE ci.cart_id=? ORDER BY ci.created_at").bind(cartId).all<any>();
  return{id:cartId,customerId:row.customer_id??undefined,currency:row.currency,items:result.results.map(x=>({productId:x.product_id,productName:x.name,slug:x.slug,quantity:x.quantity,unitPriceInCents:x.unit_price_in_cents,currency:x.currency,stock:x.stock,variantId:x.variant_id??undefined,variantName:x.variant_name??undefined}))};
 }
 async upsertItem(cartId:string,productId:string,quantity:number,variantId?:string):Promise<void>{
  assertCartQuantity(quantity);const product=await this.db.prepare("SELECT id,active,stock,price_in_cents FROM products WHERE id=?").bind(productId).first<any>();if(!product||!product.active)throw new Error("Product is unavailable");if(product.stock<quantity)throw new Error("Insufficient stock");
  let price=product.price_in_cents;if(variantId){const variant=await this.db.prepare("SELECT price_in_cents FROM product_variants WHERE id=? AND product_id=? AND active=1").bind(variantId,productId).first<any>();if(!variant)throw new Error("Variant is unavailable");price=variant.price_in_cents;}
  await this.db.prepare("INSERT INTO cart_items(cart_id,product_id,quantity,unit_price_in_cents,variant_id) VALUES(?,?,?,?,?) ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=excluded.quantity,unit_price_in_cents=excluded.unit_price_in_cents,variant_id=excluded.variant_id,updated_at=CURRENT_TIMESTAMP").bind(cartId,productId,quantity,price,variantId??null).run();await this.touch(cartId);
 }
 async removeItem(cartId:string,productId:string):Promise<void>{await this.db.prepare("DELETE FROM cart_items WHERE cart_id=? AND product_id=?").bind(cartId,productId).run();await this.touch(cartId);}
 async clear(cartId:string):Promise<void>{await this.db.prepare("DELETE FROM cart_items WHERE cart_id=?").bind(cartId).run();await this.touch(cartId);}
 private async touch(cartId:string):Promise<void>{await this.db.prepare("UPDATE carts SET updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(cartId).run();}
}
