import type { D1Database } from "@cloudflare/workers-types";
import { assertCartQuantity, type Cart } from "../domain/Cart";

type CartRow = { currency: string; customer_id: string | null };
type ProductRow = { id: string; active: number; stock: number; price_in_cents: number };
type VariantRow = { price_in_cents: number };
type CartItemRow = {
  product_id: string;
  name: string;
  slug: string;
  quantity: number;
  unit_price_in_cents: number;
  currency: string;
  stock: number;
  variant_id: string | null;
  variant_name: string | null;
};

export class D1CartRepository {
  constructor(private readonly db: D1Database) {}

  async getOrCreate(cartId: string, customerId?: string): Promise<Cart> {
    await this.db.prepare("INSERT OR IGNORE INTO carts(id,customer_id) VALUES(?,?)").bind(cartId, customerId ?? null).run();
    const row = await this.db.prepare("SELECT currency,customer_id FROM carts WHERE id=?").bind(cartId).first<CartRow>();
    if (!row) throw new Error("Cart not found");
    return this.hydrate(cartId, row);
  }

  async getOwnedByCustomer(cartId: string, customerId: string): Promise<Cart> {
    const row = await this.db.prepare("SELECT currency,customer_id FROM carts WHERE id=? AND customer_id=?").bind(cartId, customerId).first<CartRow>();
    if (!row) throw new Error("Cart belongs to another customer");
    return this.hydrate(cartId, row);
  }

  async claimForCustomer(cartId: string, customerId: string): Promise<void> {
    const result = await this.db
      .prepare("UPDATE carts SET customer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (customer_id IS NULL OR customer_id=?)")
      .bind(customerId, cartId, customerId)
      .run();
    if (result.meta.changes !== 1) throw new Error("Cart belongs to another customer");
  }

  async upsertItem(cartId: string, productId: string, quantity: number, variantId?: string): Promise<void> {
    assertCartQuantity(quantity);
    const product = await this.db.prepare("SELECT id,active,stock,price_in_cents FROM products WHERE id=?").bind(productId).first<ProductRow>();
    if (!product || !product.active) throw new Error("Product is unavailable");
    if (product.stock < quantity) throw new Error("Insufficient stock");

    let price = product.price_in_cents;
    if (variantId) {
      const variant = await this.db.prepare("SELECT price_in_cents FROM product_variants WHERE id=? AND product_id=? AND active=1").bind(variantId, productId).first<VariantRow>();
      if (!variant) throw new Error("Variant is unavailable");
      price = variant.price_in_cents;
      const existing = await this.db.prepare("SELECT variant_id FROM cart_items WHERE cart_id=? AND product_id=? LIMIT 1").bind(cartId, productId).all<{ variant_id: string | null }>();
      if (existing.results.some((x) => x.variant_id !== variantId) && existing.results.length > 0 && existing.results.every((x) => x.variant_id !== variantId)) {
        const canHaveMultiple = await this.hasVariantIdentityIndex();
        if (!canHaveMultiple) throw new Error("Cart schema update required for multiple variants");
      }
    }

    const cartItemId = crypto.randomUUID();
    await this.db
      .prepare("INSERT INTO cart_items(id,cart_id,product_id,quantity,unit_price_in_cents,variant_id) VALUES(?,?,?,?,?,?) ON CONFLICT DO UPDATE SET quantity=excluded.quantity,unit_price_in_cents=excluded.unit_price_in_cents,variant_id=excluded.variant_id,updated_at=CURRENT_TIMESTAMP WHERE cart_items.cart_id=excluded.cart_id AND cart_items.product_id=excluded.product_id AND COALESCE(cart_items.variant_id,'')=COALESCE(excluded.variant_id,'')")
      .bind(cartItemId, cartId, productId, quantity, price, variantId ?? null)
      .run();
    await this.touch(cartId);
  }

  async removeItem(cartId: string, productId: string, variantId?: string): Promise<void> {
    await this.db.prepare("DELETE FROM cart_items WHERE cart_id=? AND product_id=? AND COALESCE(variant_id,'')=COALESCE(?, '')").bind(cartId, productId, variantId ?? null).run();
    await this.touch(cartId);
  }

  async clear(cartId: string): Promise<void> {
    await this.db.prepare("DELETE FROM cart_items WHERE cart_id=?").bind(cartId).run();
    await this.touch(cartId);
  }

  private async hydrate(cartId: string, row: CartRow): Promise<Cart> {
    const result = await this.db
      .prepare("SELECT ci.product_id,p.name,p.slug,ci.quantity,ci.unit_price_in_cents,p.currency,p.stock,ci.variant_id,pv.name variant_name FROM cart_items ci JOIN products p ON p.id=ci.product_id LEFT JOIN product_variants pv ON pv.id=ci.variant_id WHERE ci.cart_id=? ORDER BY ci.created_at")
      .bind(cartId)
      .all<CartItemRow>();
    return {
      id: cartId,
      ...(row.customer_id ? { customerId: row.customer_id } : {}),
      currency: row.currency,
      items: result.results.map((x) => ({
        productId: x.product_id,
        productName: x.name,
        slug: x.slug,
        quantity: x.quantity,
        unitPriceInCents: x.unit_price_in_cents,
        currency: x.currency,
        stock: x.stock,
        ...(x.variant_id ? { variantId: x.variant_id } : {}),
        ...(x.variant_name ? { variantName: x.variant_name } : {}),
      })),
    };
  }

  private async hasVariantIdentityIndex(): Promise<boolean> {
    const row = await this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_cart_items_identity' LIMIT 1").first();
    return !!row;
  }

  private async touch(cartId: string): Promise<void> {
    await this.db.prepare("UPDATE carts SET updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(cartId).run();
  }
}
