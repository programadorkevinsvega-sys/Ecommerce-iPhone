import type { D1Database } from "@cloudflare/workers-types";
import type { CheckoutCart } from "../application/CheckoutCart";
import type { CheckoutInput, OrderCheckoutRepository } from "../application/CheckoutInput";
import type { OrderRepository } from "../application/OrderRepository";
import { assertOrderTransition, type Order, type OrderStatus } from "../domain/Order";

export class D1OrderRepository implements OrderCheckoutRepository, OrderRepository {
  constructor(
    private readonly db: D1Database,
    private readonly prepareOrderCreatedOutbox?: (
      order: Order,
      createdAt: string,
    ) => ReturnType<D1Database["prepare"]>,
  ) {}

  async checkout(cart: CheckoutCart, input: CheckoutInput): Promise<Order> {
    if (!cart.items.length) throw new Error("Cart is empty");
    await this.pruneExpiredIdempotency();
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.customerId !== input.customerId)
        throw new Error("Idempotency key belongs to another customer");
      await this.ensureOrderCreatedOutbox(existing);
      return existing;
    }

    const effectiveCart = await this.refreshServerPricing(cart);
    const subtotalInCents = effectiveCart.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceInCents,
      0,
    );
    if (input.promotionCode && input.couponCode)
      throw new Error("Only one discount code may be used");
    const promotion = input.promotionCode
      ? await this.findApplicablePromotion(input.promotionCode, effectiveCart, subtotalInCents)
      : null;
    const coupon = input.couponCode
      ? await this.findApplicableCoupon(
          input.couponCode,
          input.customerId,
          effectiveCart,
          subtotalInCents,
        )
      : null;
    if (input.promotionCode && !promotion)
      throw new Error("Promotion is invalid, inactive, expired, or unavailable");
    if (input.couponCode && !coupon)
      throw new Error("Coupon is invalid, inactive, expired, or unavailable");
    const discountSource = promotion ?? coupon;
    const discountInCents = discountSource
      ? this.calculateDiscount(
          discountSource.discountType,
          discountSource.discountValue,
          discountSource.eligibleSubtotalInCents,
        )
      : 0;
    const shippingInCents = input.shippingMethod === "PICKUP" ? 0 : 1500000;
    const totalInCents = subtotalInCents + shippingInCents - discountInCents;
    const orderId = crypto.randomUUID();
    const orderNumber = `EIP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const orderItems = effectiveCart.items.map((item) => ({ ...item, id: crypto.randomUUID() }));
    const createdAt = new Date().toISOString();
    const order: Order = {
      id: orderId,
      orderNumber,
      customerId: input.customerId,
      email: input.email,
      status: "PENDING_PAYMENT",
      currency: effectiveCart.currency,
      subtotalInCents,
      shippingInCents,
      discountInCents,
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
    if (!this.prepareOrderCreatedOutbox) throw new Error("CHECKOUT_OUTBOX_NOT_CONFIGURED");
    const statements: ReturnType<D1Database["prepare"]>[] = [
      this.db
        .prepare(
          "INSERT INTO checkout_idempotency(idempotency_key,customer_id,order_id,expires_at) VALUES(?,?,?,datetime('now','+24 hours'))",
        )
        .bind(input.idempotencyKey, input.customerId, orderId),
    ];

    for (const item of effectiveCart.items) {
      statements.push(
        this.db
          .prepare(
            "UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1 AND stock>=?",
          )
          .bind(item.quantity, item.productId, item.quantity),
      );
      statements.push(
        this.db.prepare("INSERT INTO checkout_guards(id) SELECT 1 WHERE changes()=0"),
      );
    }

    if (promotion) {
      statements.push(
        this.db
          .prepare(
            "UPDATE promotions SET used_count=used_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1 AND starts_at<=CURRENT_TIMESTAMP AND ends_at>CURRENT_TIMESTAMP AND min_subtotal_in_cents<=? AND (max_uses IS NULL OR used_count<max_uses)",
          )
          .bind(promotion.id, subtotalInCents),
      );
      statements.push(
        this.db.prepare("INSERT INTO checkout_guards(id) SELECT 1 WHERE changes()=0"),
      );
    }

    statements.push(
      this.db
        .prepare(
          "INSERT INTO orders(id,order_number,customer_id,email,status,currency,subtotal_in_cents,shipping_in_cents,discount_in_cents,total_in_cents,shipping_method,shipping_recipient_name,shipping_phone,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          orderId,
          orderNumber,
          input.customerId,
          input.email,
          "PENDING_PAYMENT",
          effectiveCart.currency,
          subtotalInCents,
          shippingInCents,
          discountInCents,
          totalInCents,
          input.shippingMethod,
          input.shippingAddress.recipientName,
          input.shippingAddress.phone,
          input.shippingAddress.addressLine1,
          input.shippingAddress.addressLine2 ?? null,
          input.shippingAddress.city,
          input.shippingAddress.state,
          input.shippingAddress.postalCode ?? null,
          input.shippingAddress.countryCode,
        ),
    );

    if (coupon) {
      statements.push(
        this.db
          .prepare(
            "UPDATE coupons SET used_count=used_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1 AND starts_at<=CURRENT_TIMESTAMP AND ends_at>CURRENT_TIMESTAMP AND min_subtotal_in_cents<=? AND (max_uses IS NULL OR used_count<max_uses) AND (max_uses_per_customer IS NULL OR (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=? AND customer_id=?)<max_uses_per_customer)",
          )
          .bind(coupon.id, subtotalInCents, coupon.id, input.customerId),
      );
      statements.push(
        this.db.prepare("INSERT INTO checkout_guards(id) SELECT 1 WHERE changes()=0"),
      );
      statements.push(
        this.db
          .prepare(
            "INSERT INTO coupon_redemptions(id,coupon_id,customer_id,order_id,amount_in_cents) SELECT ?,?,?,?,? WHERE changes()=1",
          )
          .bind(crypto.randomUUID(), coupon.id, input.customerId, orderId, discountInCents),
      );
      statements.push(
        this.db.prepare("INSERT INTO checkout_guards(id) SELECT 1 WHERE changes()=0"),
      );
    }

    for (const item of orderItems) {
      statements.push(
        this.db
          .prepare(
            "INSERT INTO inventory_reservations(id,cart_id,product_id,quantity,expires_at,order_id) VALUES(?,?,?,?,datetime('now','+15 minutes'),?)",
          )
          .bind(crypto.randomUUID(), effectiveCart.id, item.productId, item.quantity, orderId),
      );
      statements.push(
        this.db
          .prepare(
            "INSERT INTO order_items(id,order_id,product_id,variant_id,product_name,product_slug,quantity,unit_price_in_cents,line_total_in_cents) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            item.id,
            orderId,
            item.productId,
            item.variantId ?? null,
            item.productName,
            item.slug,
            item.quantity,
            item.unitPriceInCents,
            item.quantity * item.unitPriceInCents,
          ),
      );
    }

    statements.push(
      this.db
        .prepare("INSERT INTO order_events(id,order_id,event_type,payload_json) VALUES(?,?,?,?)")
        .bind(
          `order-created:${orderId}`,
          orderId,
          "OrderCreated",
          JSON.stringify({
            orderId,
            orderNumber,
            totalInCents,
            currency: effectiveCart.currency,
            ...(promotion
              ? { promotionCode: promotion.code, discountInCents }
              : coupon
                ? { couponCode: coupon.code, discountInCents }
                : {}),
          }),
        ),
    );
    statements.push(this.prepareOrderCreatedOutbox(order, createdAt));
    statements.push(this.db.prepare("INSERT INTO checkout_guards(id) SELECT 1 WHERE changes()=0"));
    statements.push(
      this.db.prepare("DELETE FROM cart_items WHERE cart_id=?").bind(effectiveCart.id),
    );

    try {
      await this.db.batch(statements);
    } catch (error) {
      const raced = await this.findByIdempotencyKey(input.idempotencyKey);
      if (raced) {
        if (raced.customerId !== input.customerId)
          throw new Error("Idempotency key belongs to another customer");
        return raced;
      }
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("checkout_guards.id") &&
        (await this.hasInsufficientStock(effectiveCart))
      ) {
        throw new Error("INSUFFICIENT_STOCK");
      }
      throw error;
    }

    return order;
  }

  private async hasInsufficientStock(cart: CheckoutCart): Promise<boolean> {
    for (const item of cart.items) {
      const product = await this.db
        .prepare("SELECT active,stock FROM products WHERE id=?")
        .bind(item.productId)
        .first<{ active: number; stock: number }>();
      if (!product || product.active !== 1 || product.stock < item.quantity) return true;
    }
    return false;
  }

  private async ensureOrderCreatedOutbox(order: Order): Promise<void> {
    if (!this.prepareOrderCreatedOutbox) throw new Error("CHECKOUT_OUTBOX_NOT_CONFIGURED");
    const eventId = `order-created:${order.id}`;
    const existing = await this.db
      .prepare("SELECT 1 AS present FROM notification_outbox WHERE id=? LIMIT 1")
      .bind(eventId)
      .first<{ present: number }>();
    if (existing) return;
    await this.db.batch([this.prepareOrderCreatedOutbox(order, new Date().toISOString())]);
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<OrderRow>();
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  async findByIdempotencyKeyForCustomer(key: string, customerId: string): Promise<Order | null> {
    const row = await this.db
      .prepare(
        "SELECT o.* FROM checkout_idempotency i JOIN orders o ON o.id=i.order_id WHERE i.idempotency_key=? AND i.customer_id=? AND i.expires_at>CURRENT_TIMESTAMP LIMIT 1",
      )
      .bind(key, customerId)
      .first<OrderRow>();
    return row ? this.hydrateOrder(row) : null;
  }

  async listByCustomer(
    customerId: string,
    limit: number,
    offset: number,
  ): Promise<readonly Order[]> {
    if (!customerId) throw new Error("Customer authentication is required");
    if (!Number.isFinite(limit) || !Number.isFinite(offset)) throw new Error("Invalid pagination");
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const safeOffset = Math.max(Math.trunc(offset), 0);
    const rows = await this.db
      .prepare(
        "SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
      )
      .bind(customerId, safeLimit, safeOffset)
      .all<OrderRow>();
    return Promise.all(rows.results.map((row) => this.hydrateOrder(row)));
  }

  async transitionStatus(id: string, from: string, to: string): Promise<boolean> {
    assertOrderTransition(from as OrderStatus, to as OrderStatus);
    const result = await this.db.batch([
      this.db
        .prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?")
        .bind(to, id, from),
      this.db
        .prepare(
          "INSERT INTO order_events(id,order_id,event_type,payload_json) SELECT ?,?,?,? WHERE changes()=1",
        )
        .bind(crypto.randomUUID(), id, "OrderStatusChanged", JSON.stringify({ from, to })),
    ]);
    return result[0]?.meta.changes === 1;
  }

  private async refreshServerPricing(cart: CheckoutCart): Promise<CheckoutCart> {
    const items = [];
    for (const item of cart.items) {
      const product = await this.db
        .prepare("SELECT id,name,slug,active,price_in_cents,currency FROM products WHERE id=?")
        .bind(item.productId)
        .first<{
          id: string;
          name: string;
          slug: string;
          active: number;
          price_in_cents: number;
          currency: string;
        }>();
      if (!product || !product.active) throw new Error("Product is unavailable");
      if (product.currency !== cart.currency)
        throw new Error("Cart currency does not match product currency");

      let priceInCents = product.price_in_cents;
      if (item.variantId) {
        const variant = await this.db
          .prepare("SELECT price_in_cents,active FROM product_variants WHERE id=? AND product_id=?")
          .bind(item.variantId, item.productId)
          .first<{ price_in_cents: number; active: number }>();
        if (!variant || !variant.active) throw new Error("Variant is unavailable");
        priceInCents = variant.price_in_cents;
      }
      items.push({
        ...item,
        productName: product.name,
        slug: product.slug,
        unitPriceInCents: priceInCents,
      });
    }
    return { ...cart, items };
  }

  private async findApplicablePromotion(
    code: string,
    cart: CheckoutCart,
    subtotalInCents: number,
  ): Promise<DiscountRow | null> {
    const row = await this.db
      .prepare(
        "SELECT id,code,discount_type AS discountType,discount_value AS discountValue,min_subtotal_in_cents AS minSubtotalInCents FROM promotions WHERE code=? COLLATE NOCASE AND active=1 AND starts_at<=CURRENT_TIMESTAMP AND ends_at>CURRENT_TIMESTAMP AND min_subtotal_in_cents<=? AND (max_uses IS NULL OR used_count<max_uses) LIMIT 1",
      )
      .bind(code, subtotalInCents)
      .first<{
        id: string;
        code: string;
        discountType: "PERCENT" | "FIXED";
        discountValue: number;
        minSubtotalInCents: number;
      }>();
    if (!row) return null;
    const eligibleSubtotalInCents = await this.eligibleSubtotal(row.id, cart, "promotion");
    return eligibleSubtotalInCents > 0 ? { ...row, eligibleSubtotalInCents } : null;
  }

  private async findApplicableCoupon(
    code: string,
    customerId: string,
    cart: CheckoutCart,
    subtotalInCents: number,
  ): Promise<DiscountRow | null> {
    const row = await this.db
      .prepare(
        "SELECT id,code,discount_type AS discountType,discount_value AS discountValue,min_subtotal_in_cents AS minSubtotalInCents FROM coupons WHERE code=? COLLATE NOCASE AND active=1 AND starts_at<=CURRENT_TIMESTAMP AND ends_at>CURRENT_TIMESTAMP AND min_subtotal_in_cents<=? AND (max_uses IS NULL OR used_count<max_uses) AND (max_uses_per_customer IS NULL OR (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=coupons.id AND customer_id=?)<max_uses_per_customer) LIMIT 1",
      )
      .bind(code, subtotalInCents, customerId)
      .first<{
        id: string;
        code: string;
        discountType: "PERCENT" | "FIXED";
        discountValue: number;
        minSubtotalInCents: number;
      }>();
    if (!row) return null;
    const eligibleSubtotalInCents = await this.eligibleSubtotal(row.id, cart, "coupon");
    return eligibleSubtotalInCents > 0 ? { ...row, eligibleSubtotalInCents } : null;
  }

  private async eligibleSubtotal(
    id: string,
    cart: CheckoutCart,
    table: "promotion" | "coupon",
  ): Promise<number> {
    let total = 0;
    const link = table === "promotion" ? "promotion_products" : "coupon_products";
    const categoryLink = table === "promotion" ? "promotion_categories" : "coupon_categories";
    for (const item of cart.items) {
      const row = await this.db
        .prepare(
          `SELECT EXISTS(SELECT 1 FROM ${link} WHERE ${table}_id=? AND product_id=?) OR EXISTS(SELECT 1 FROM ${categoryLink} pc JOIN product_categories pcat ON pcat.category_id=pc.category_id WHERE pc.${table}_id=? AND pcat.product_id=?) AS eligible`,
        )
        .bind(id, item.productId, id, item.productId)
        .first<{ eligible: number }>();
      if (row?.eligible === 1) total += item.quantity * item.unitPriceInCents;
    }
    const targets = await this.db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM ${link} WHERE ${table}_id=?) + (SELECT COUNT(*) FROM ${categoryLink} WHERE ${table}_id=?) AS count`,
      )
      .bind(id, id)
      .first<{ count: number }>();
    return targets?.count === 0
      ? cart.items.reduce((sum, item) => sum + item.quantity * item.unitPriceInCents, 0)
      : total;
  }

  private calculateDiscount(
    type: "PERCENT" | "FIXED",
    value: number,
    eligibleSubtotalInCents: number,
  ): number {
    return type === "PERCENT"
      ? Math.min(eligibleSubtotalInCents, Math.floor((eligibleSubtotalInCents * value) / 100))
      : Math.min(eligibleSubtotalInCents, value);
  }

  private async pruneExpiredIdempotency(): Promise<void> {
    await this.db
      .prepare("DELETE FROM checkout_idempotency WHERE expires_at<=CURRENT_TIMESTAMP")
      .run();
  }

  private async findByIdempotencyKey(key: string): Promise<Order | null> {
    const row = await this.db
      .prepare(
        "SELECT order_id FROM checkout_idempotency WHERE idempotency_key=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1",
      )
      .bind(key)
      .first<{ order_id: string }>();
    return row ? this.findById(row.order_id) : null;
  }

  private async hydrateOrder(row: OrderRow): Promise<Order> {
    const items = await this.db
      .prepare(
        "SELECT id,product_id,variant_id,product_name,product_slug,quantity,unit_price_in_cents,line_total_in_cents FROM order_items WHERE order_id=? ORDER BY id ASC",
      )
      .bind(row.id)
      .all<OrderItemRow>();
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

type DiscountRow = {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minSubtotalInCents: number;
  eligibleSubtotalInCents: number;
};
type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string | null;
  email: string;
  status: Order["status"];
  currency: string;
  subtotal_in_cents: number;
  shipping_in_cents: number;
  discount_in_cents: number;
  total_in_cents: number;
  shipping_method: string;
  shipping_recipient_name: string;
  shipping_phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string | null;
  shipping_country_code: string;
};
type OrderItemRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_slug: string;
  quantity: number;
  unit_price_in_cents: number;
  line_total_in_cents: number;
};
