import type { D1Database } from "@cloudflare/workers-types";
import type { CheckoutCart } from "../application/CheckoutCart";
import type { CheckoutInput, OrderCheckoutRepository } from "../application/CheckoutInput";
import type { Order } from "../domain/Order";

export class D1OrderRepository implements OrderCheckoutRepository {
  constructor(private readonly db: D1Database) {}

  async checkout(cart: CheckoutCart, input: CheckoutInput): Promise<Order> {
    if (!cart.items.length) throw new Error("Cart is empty");
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.customerId !== input.customerId) throw new Error("Idempotency key belongs to another customer");
      return existing;
    }

    const subtotalInCents = cart.items.reduce((sum, item) => sum + item.quantity * item.unitPriceInCents, 0);
    const shippingInCents = input.shippingMethod === "PICKUP" ? 0 : 1500000;
    const totalInCents = subtotalInCents + shippingInCents;
    const orderId = crypto.randomUUID();
    const orderNumber = `EIP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const statements: ReturnType<D1Database["prepare"]>[] = [
      this.db.prepare("INSERT INTO checkout_idempotency(idempotency_key,customer_id,order_id) VALUES(?,?,?)").bind(input.idempotencyKey, input.customerId, orderId),
    ];

    for (const item of cart.items) {
      statements.push(this.db.prepare("UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1 AND stock>=?").bind(item.quantity, item.productId, item.quantity));
      statements.push(this.db.prepare("INSERT INTO checkout_guards(id) SELECT 1 WHERE changes()=0"));
      statements.push(this.db.prepare("INSERT INTO inventory_reservations(id,cart_id,product_id,quantity,expires_at) VALUES(?,?,?,?,datetime('now','+15 minutes'))").bind(crypto.randomUUID(), cart.id, item.productId, item.quantity));
    }

    statements.push(
      this.db.prepare("INSERT INTO orders(id,order_number,customer_id,email,status,currency,subtotal_in_cents,shipping_in_cents,discount_in_cents,total_in_cents,shipping_method,shipping_recipient_name,shipping_phone,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(
        orderId, orderNumber, input.customerId, input.email, "PENDING_PAYMENT", cart.currency, subtotalInCents, shippingInCents, 0, totalInCents,
        input.shippingMethod, input.shippingAddress.recipientName, input.shippingAddress.phone, input.shippingAddress.addressLine1,
        input.shippingAddress.addressLine2 ?? null, input.shippingAddress.city, input.shippingAddress.state, input.shippingAddress.postalCode ?? null, input.shippingAddress.countryCode,
      ),
    );

    for (const item of cart.items) {
      statements.push(this.db.prepare("INSERT INTO order_items(id,order_id,product_id,product_name,product_slug,quantity,unit_price_in_cents,line_total_in_cents) VALUES(?,?,?,?,?,?,?,?)").bind(
        crypto.randomUUID(), orderId, item.productId, item.productName, item.slug, item.quantity, item.unitPriceInCents, item.quantity * item.unitPriceInCents,
      ));
    }

    statements.push(this.db.prepare("INSERT INTO order_events(id,order_id,event_type,payload_json) VALUES(?,?,?,?)").bind(
      crypto.randomUUID(), orderId, "OrderCreated", JSON.stringify({ orderId, orderNumber, totalInCents, currency: cart.currency }),
    ));
    statements.push(this.db.prepare("DELETE FROM cart_items WHERE cart_id=?").bind(cart.id));

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
      currency: cart.currency,
      subtotalInCents,
      shippingInCents,
      discountInCents: 0,
      totalInCents,
      shippingMethod: input.shippingMethod,
      shippingAddress: input.shippingAddress,
      items: cart.items.map((item) => ({ id: crypto.randomUUID(), productId: item.productId, productName: item.productName, productSlug: item.slug, quantity: item.quantity, unitPriceInCents: item.unitPriceInCents, lineTotalInCents: item.quantity * item.unitPriceInCents })),
    };
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<any>();
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  private async findByIdempotencyKey(key: string): Promise<Order | null> {
    const row = await this.db.prepare("SELECT order_id FROM checkout_idempotency WHERE idempotency_key=? LIMIT 1").bind(key).first<{ order_id: string }>();
    return row ? this.findById(row.order_id) : null;
  }

  private async hydrateOrder(row: any): Promise<Order> {
    const items = await this.db.prepare("SELECT id,product_id,product_name,product_slug,quantity,unit_price_in_cents,line_total_in_cents FROM order_items WHERE order_id=?").bind(row.id).all<any>();
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
        productName: item.product_name,
        productSlug: item.product_slug,
        quantity: item.quantity,
        unitPriceInCents: item.unit_price_in_cents,
        lineTotalInCents: item.line_total_in_cents,
      })),
    };
  }
}
