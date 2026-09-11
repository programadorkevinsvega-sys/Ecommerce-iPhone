import type { D1Database } from "@cloudflare/workers-types";
import type { CheckoutCart } from "../application/CheckoutCart";
import type { CheckoutInput, OrderCheckoutRepository } from "../application/CheckoutInput";
import type { OrderRepository } from "../application/OrderRepository";
import type { Order } from "../domain/Order";

export class D1OrderRepository implements OrderCheckoutRepository, OrderRepository {
  constructor(private readonly db: D1Database) {}

  async checkout(cart: CheckoutCart, input: CheckoutInput): Promise<Order> {
    if (!cart.items.length) throw new Error("Cart is empty");
    await this.pruneExpiredIdempotency();
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.customerId !== input.customerId) throw new Error("Idempotency key belongs to another customer");
      return existing;
    }

    const effectiveCart = await this.refreshServerPricing(cart);
    const subtotalInCents = effectiveCart.items.reduce((sum, item) => sum + item.quantity * item.unitPriceInCents, 0);
    const shippingInCents = input.shippingMethod === "PICKUP" ? 0 : 1500000;
    const totalInCents = subtotalInCents + shippingInCents;
    const orderId = crypto.randomUUID();
    const orderNumber = `EIP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const orderItems = effectiveCart.items.map((item) => ({ ...item, id: crypto.randomUUID() }));
    const statements: ReturnType<D1Database["prepare"]>[] = [
      this.db.prepare("INSERT INTO checkout_idempotency(idempotency_key,customer_id,order_id,expires_at) VALUES(?,?,?,datetime('now','+24 hours'))").bind(input.idempotencyKey, input.customerId, orderId),
    ];

    for (const item of effectiveCart.items) {
      statements.push(this.db.prepare("UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1 AND stock>=?").bind(item.quantity, item.productId, item.quantity));
      statements.push(this.db.prepare("INSERT INTO checkout_guards(id) SELECT 1 WHERE changes()=0"));
    }

    statements.push(this.db.prepare("INSERT INTO orders(id,order_number,customer_id,email,status,currency,subtotal_in_cents,shipping_in_cents,discount_in_cents,total_in_cents,shipping_method,shipping_recipient_name,shipping_phone,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(
      orderId, orderNumber, input.customerId, input.email, "PENDING_PAYMENT", effectiveCart.currency, subtotalInCents, shippingInCents, 0, totalInCents,
      input.shippingMethod, input.shippingAddress.recipientName, input.shippingAddress.phone, input.shippingAddress.addressLine1,
      input.shippingAddress.addressLine2 ?? null, input.shippingAddress.city, input.shippingAddress.state, input.shippingAddress.postalCode ?? null, input.shippingAddress.countryCode,
    ));

    for (const item of orderItems) {
      statements.push(this.db.prepare("INSERT INTO inventory_reservations(id,cart_id,product_id,quantity,expires_at,order_id) VALUES(?,?,?,?,datetime('now','+15 minutes'),?)").bind(
        crypto.randomUUID(), effectiveCart.id, item.productId, item.quantity, orderId,
      ));
      statements.push(this.db.prepare("INSERT INTO order_items(id,order_id,product_id,variant_id,product_name,product_slug,quantity,unit_price_in_cents,line_total_in_cents) VALUES(?,?,?,?,?,?,?,?,?)").bind(
        item.id, orderId, item.productId, item.variantId ?? null, item.productName, item.slug, item.quantity, item.unitPriceInCents, item.quantity * item.unitPriceInCents,
      ));
    }

    statements.push(this.db.prepare("INSERT INTO order_events(id,order_id,event_type,payload_json) VALUES(?,?,?,?)").bind(
      crypto.randomUUID(), orderId, "OrderCreated", JSON.stringify({ orderId, orderNumber, totalInCents, currency: effectiveCart.currency }),
    ));
    statements.push(this.db.prepare("DELETE FROM cart_items WHERE cart_id=?").bind(effectiveCart.id));

    try {
      await this.db.batch(statements);
    } catch (error) {
      const raced = await this.findByIdempotencyKey(input.idempotencyKey);
      if (raced) {
        if (raced.customerId !== input.customerId) throw new Error("Idempotency key belongs to another customer");
        return raced;
      }
      throw error;
    }

    return {
      id: orderId,
      orderNumber,
      customerId: input.customerId,
      email: input.email,
      status: "PENDING_PAYMENT",
      currency: effectiveCart.currency,
      subtotalInCents,
      shippingInCents,
      discountInCents: 0,
      totalInCents,
      shippingMethod: input.shippingMethod,
      shippingAddress: input.shippingAddress,
      items: orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        productName: item.productName,
        productSlug: item.slug,
        quantity: item.quantity,
        unitPriceInCents: item.unitPriceInCents,
        lineTotalInCents: item.quantity * item.unitPriceInCents,
      })),
    };
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<OrderRow>();
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  async listByCustomer(customerId: string, limit: number, offset: number): Promise<readonly Order[]> {
    if (!customerId) throw new Error("Customer authentication is required");
    if (!Number.isFinite(limit) || !Number.isFinite(offset)) throw new Error("Invalid pagination");
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const safeOffset = Math.max(Math.trunc(offset), 0);
    const rows = await this.db.prepare("SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").bind(customerId, safeLimit, safeOffset).all<OrderRow>();
    return Promise.all(rows.results.map((row) => this.hydrateOrder(row)));
  }

  async transitionStatus(id: string, from: string, to: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(to, id, from).run();
    if (result.meta.changes === 1) {
      await this.db.prepare("INSERT INTO order_events(id,order_id,event_type,payload_json) VALUES(?,?,?,?)").bind(
        crypto.randomUUID(), id, "OrderStatusChanged", JSON.stringify({ from, to }),
      ).run();
    }
    return result.meta.changes === 1;
  }

  private async refreshServerPricing(cart: CheckoutCart): Promise<CheckoutCart> {
    const items = [];
    for (const item of cart.items) {
      const product = await this.db.prepare("SELECT id,name,slug,active,price_in_cents,currency FROM products WHERE id=?").bind(item.productId).first<{ id: string; name: string; slug: string; active: number; price_in_cents: number; currency: string }>();
      if (!product || !product.active) throw new Error("Product is unavailable");
      if (product.currency !== cart.currency) throw new Error("Cart currency does not match product currency");

      let priceInCents = product.price_in_cents;
      if (item.variantId) {
        const variant = await this.db.prepare("SELECT price_in_cents,active FROM product_variants WHERE id=? AND product_id=?").bind(item.variantId, item.productId).first<{ price_in_cents: number; active: number }>();
        if (!variant || !variant.active) throw new Error("Variant is unavailable");
        priceInCents = variant.price_in_cents;
      }
      items.push({ ...item, productName: product.name, slug: product.slug, unitPriceInCents: priceInCents });
    }
    return { ...cart, items };
  }

  private async pruneExpiredIdempotency(): Promise<void> {
    await this.db.prepare("DELETE FROM checkout_idempotency WHERE expires_at<=CURRENT_TIMESTAMP").run();
  }

  private async findByIdempotencyKey(key: string): Promise<Order | null> {
    const row = await this.db.prepare("SELECT order_id FROM checkout_idempotency WHERE idempotency_key=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(key).first<{ order_id: string }>();
    return row ? this.findById(row.order_id) : null;
  }

  private async hydrateOrder(row: OrderRow): Promise<Order> {
    const items = await this.db.prepare("SELECT id,product_id,variant_id,product_name,product_slug,quantity,unit_price_in_cents,line_total_in_cents FROM order_items WHERE order_id=? ORDER BY id ASC").bind(row.id).all<OrderItemRow>();
    return {
      id: row.id,
      orderNumber: row.order_number,
      ...(row.customer_id ? { customerId: row.customer_id } : {}),
      email: row.email,
      status: row.status,
      currency: row.currency,
      subtotalInCents: row.subtotal_in_cents,
      shippingInCents: row.shipping_in_cents,
      discountInCents: row.discount_in_cents,
      totalInCents: row.total_in_cents,
      shippingMethod: row.shipping_method,
      shippingAddress: {
        recipientName: row.shipping_recipient_name,
        phone: row.shipping_phone,
        addressLine1: row.shipping_address_line1,
        ...(row.shipping_address_line2 ? { addressLine2: row.shipping_address_line2 } : {}),
        city: row.shipping_city,
        state: row.shipping_state,
        ...(row.shipping_postal_code ? { postalCode: row.shipping_postal_code } : {}),
        countryCode: row.shipping_country_code,
      },
      items: items.results.map((item) => ({
        id: item.id,
        productId: item.product_id,
        ...(item.variant_id ? { variantId: item.variant_id } : {}),
        productName: item.product_name,
        productSlug: item.product_slug,
        quantity: item.quantity,
        unitPriceInCents: item.unit_price_in_cents,
        lineTotalInCents: item.line_total_in_cents,
      })),
    };
  }
}

type OrderRow = {
  id: string; order_number: string; customer_id: string | null; email: string; status: Order["status"]; currency: string;
  subtotal_in_cents: number; shipping_in_cents: number; discount_in_cents: number; total_in_cents: number; shipping_method: string;
  shipping_recipient_name: string; shipping_phone: string; shipping_address_line1: string; shipping_address_line2: string | null;
  shipping_city: string; shipping_state: string; shipping_postal_code: string | null; shipping_country_code: string;
};
type OrderItemRow = { id: string; product_id: string; variant_id: string | null; product_name: string; product_slug: string; quantity: number; unit_price_in_cents: number; line_total_in_cents: number };
