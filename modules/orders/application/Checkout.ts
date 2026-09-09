import type { D1Database } from "@cloudflare/workers-types";
import type { Cart } from "../domain/Cart";
import type { CheckoutInput } from "./D1OrderRepository";

export async function releaseExpiredReservations(db:D1Database):Promise<number>{
  const rows=await db.prepare("SELECT id,product_id,quantity FROM inventory_reservations WHERE released_at IS NULL AND expires_at<=CURRENT_TIMESTAMP").all<any>();
  if(!rows.results.length)return 0;
  const statements:any[]=[]; for(const row of rows.results){statements.push(db.prepare("UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.quantity,row.product_id));statements.push(db.prepare("UPDATE inventory_reservations SET released_at=CURRENT_TIMESTAMP WHERE id=? AND released_at IS NULL").bind(row.id));}
  await db.batch(statements); return rows.results.length;
}

export class Checkout {
  constructor(private readonly db:D1Database, private readonly orderRepo:{checkout(cart:Cart,input:CheckoutInput):Promise<any>}){}
  async execute(cart:Cart,input:CheckoutInput){
    if(cart.items.some(item=>item.quantity>item.stock)) throw new Error("One or more products no longer have enough stock");
    if(input.shippingMethod !== "PICKUP" && input.shippingMethod !== "DELIVERY") throw new Error("Invalid shipping method");
    if(input.shippingAddress.countryCode !== "CO") throw new Error("Shipping is currently limited to Colombia");
    await releaseExpiredReservations(this.db);
    return this.orderRepo.checkout(cart,input);
  }
}
