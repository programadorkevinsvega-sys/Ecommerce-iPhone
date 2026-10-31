import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  executeLocalD1,
  queryLocalD1,
  resetCheckoutInventory,
  sqlLiteral,
} from "./support/localD1";

const PRODUCT_ID = "prod-iphone-17-pro-max";
const VARIANT_ID = "var-iphone-17-256-deep-blue";
const OUT_OF_STOCK_PRODUCT_ID = "prod-iphone-18-pro-max";
const OUT_OF_STOCK_VARIANT_ID = "var-iphone-18-256-silver";
const API_BASE_URL = "http://127.0.0.1:8787";
const ORIGINAL_VARIANT_PRICE = 464900000;
const createdCartIds = new Set<string>();
const createdEmails = new Set<string>();

type CartResponse = {
  id: string;
  currency: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPriceInCents: number;
    stock: number;
  }>;
};

type E2EOrder = {
  id: string;
  status: string;
  subtotalInCents: number;
  shippingInCents: number;
  discountInCents: number;
  totalInCents: number;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPriceInCents: number;
    lineTotalInCents: number;
  }>;
};

function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

function checkoutPayload(
  email: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    email,
    firstName: "Playwright",
    lastName: "Customer",
    phone: "+573001234567",
    shippingMethod: "DELIVERY",
    shippingAddress: {
      recipientName: "Playwright Customer",
      phone: "+573001234567",
      addressLine1: "Calle 10 20-30",
      city: "Medellin",
      state: "Antioquia",
      countryCode: "CO",
    },
    ...overrides,
  };
}

async function createCart(api: APIRequestContext): Promise<string> {
  const response = await api.get("/api/cart");
  expect(response.status()).toBe(200);
  const cart = (await response.json()) as CartResponse;
  expect(cart.id).toBeTruthy();
  createdCartIds.add(cart.id);
  return cart.id;
}

async function addTestProduct(
  api: APIRequestContext,
  options: {
    productId?: string;
    variantId?: string;
    quantity?: number;
    clientPriceInCents?: number;
  } = {},
): Promise<CartResponse> {
  const response = await api.post("/api/cart", {
    data: {
      productId: options.productId ?? PRODUCT_ID,
      variantId: options.variantId ?? VARIANT_ID,
      quantity: options.quantity ?? 1,
      ...(options.clientPriceInCents !== undefined
        ? { unitPriceInCents: options.clientPriceInCents }
        : {}),
    },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as CartResponse;
}

async function sendCheckout(
  api: APIRequestContext,
  email: string,
  idempotencyKey = randomUUID(),
  overrides: Record<string, unknown> = {},
) {
  createdEmails.add(email);
  const response = await api.post("/api/checkout", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: checkoutPayload(email, overrides),
  });
  return { response, idempotencyKey };
}

async function placeOrder(
  api: APIRequestContext,
  email = uniqueEmail(),
): Promise<{ order: E2EOrder; email: string; cartId: string; idempotencyKey: string }> {
  const cartId = await createCart(api);
  await addTestProduct(api);
  const { response, idempotencyKey } = await sendCheckout(api, email);
  expect(response.status()).toBe(201);
  const result = (await response.json()) as { order: E2EOrder };
  return { order: result.order, email, cartId, idempotencyKey };
}

test.describe("critical commerce and security journeys", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    resetCheckoutInventory(100);
  });

  test.afterEach(() => {
    const emails = Array.from(createdEmails);
    const cartIds = Array.from(createdCartIds);
    createdEmails.clear();
    createdCartIds.clear();

    if (emails.length > 0) {
      const emailList = emails.map(sqlLiteral).join(", ");
      const orderIds = `SELECT id FROM orders WHERE email IN (${emailList})`;
      const outboxIds = `SELECT id FROM notification_outbox WHERE aggregate_id IN (${orderIds})`;

      executeLocalD1(
        [
          `DELETE FROM notification_deliveries WHERE outbox_id IN (${outboxIds})`,
          `DELETE FROM notification_outbox WHERE aggregate_id IN (${orderIds})`,
          `DELETE FROM inventory_reservations WHERE order_id IN (${orderIds})`,
          `DELETE FROM order_items WHERE order_id IN (${orderIds})`,
          `DELETE FROM order_events WHERE order_id IN (${orderIds})`,
          `DELETE FROM coupon_redemptions WHERE order_id IN (${orderIds})`,
          `DELETE FROM checkout_idempotency WHERE customer_id IN (SELECT id FROM customers WHERE email IN (${emailList}))`,
          `DELETE FROM orders WHERE email IN (${emailList})`,
          `DELETE FROM customers WHERE email IN (${emailList})`,
        ].join(";\\n") + ";",
      );
    }

    if (cartIds.length > 0) {
      const cartList = cartIds.map(sqlLiteral).join(", ");
      executeLocalD1(
        [
          `DELETE FROM inventory_reservations WHERE cart_id IN (${cartList})`,
          `DELETE FROM cart_items WHERE cart_id IN (${cartList})`,
          `DELETE FROM carts WHERE id IN (${cartList})`,
        ].join(";\\n") + ";",
      );
    }
  });

  test("cart supports add, quantity change, invalid quantity, removal and unavailable stock", async ({
    request,
  }) => {
    const cartId = await createCart(request);

    const added = await addTestProduct(request, { clientPriceInCents: 1 });
    expect(added.items).toHaveLength(1);
    expect(added.items[0]).toMatchObject({
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      quantity: 1,
      unitPriceInCents: ORIGINAL_VARIANT_PRICE,
      stock: 100,
    });

    const updatedResponse = await request.post("/api/cart", {
      data: { productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 2 },
    });
    expect(updatedResponse.status()).toBe(200);
    const updated = (await updatedResponse.json()) as CartResponse;
    expect(updated.items[0].quantity).toBe(2);

    const invalidQuantity = await request.post("/api/cart", {
      data: { productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 0 },
    });
    expect(invalidQuantity.status()).toBe(422);

    const unavailable = await request.post("/api/cart", {
      data: {
        productId: OUT_OF_STOCK_PRODUCT_ID,
        variantId: OUT_OF_STOCK_VARIANT_ID,
        quantity: 1,
      },
    });
    expect(unavailable.status()).toBe(409);

    const unchanged = (await (await request.get("/api/cart")).json()) as CartResponse;
    expect(unchanged.id).toBe(cartId);
    expect(unchanged.items).toHaveLength(1);
    expect(unchanged.items[0].quantity).toBe(2);

    const removed = await request.delete("/api/cart", {
      data: { productId: PRODUCT_ID, variantId: VARIANT_ID },
    });
    expect(removed.status()).toBe(200);
    const empty = (await (await request.get("/api/cart")).json()) as CartResponse;
    expect(empty.items).toHaveLength(0);
  });

  test("malformed and invalid checkout requests do not create customers, orders or stock changes", async ({
    request,
  }) => {
    const cartId = await createCart(request);
    await addTestProduct(request);
    const email = uniqueEmail();

    const malformedCart = await request.post("/api/cart", {
      headers: { "content-type": "application/json" },
      data: "{",
    });
    expect(malformedCart.status()).toBe(400);

    const malformedCheckout = await request.post("/api/checkout", {
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      data: "{",
    });
    expect(malformedCheckout.status()).toBe(400);

    const missingIdempotencyKey = await request.post("/api/checkout", {
      data: checkoutPayload(email),
    });
    expect(missingIdempotencyKey.status()).toBe(422);

    const invalidPhone = await sendCheckout(request, email, randomUUID(), {
      phone: "not-a-phone",
    });
    expect(invalidPhone.response.status()).toBe(422);

    const state = queryLocalD1<{
      stock: number;
      customers: number;
      orders: number;
      cartItems: number;
    }>(
      `SELECT
        (SELECT stock FROM products WHERE id=${sqlLiteral(PRODUCT_ID)}) AS stock,
        (SELECT COUNT(*) FROM customers WHERE email=${sqlLiteral(email)}) AS customers,
        (SELECT COUNT(*) FROM orders WHERE email=${sqlLiteral(email)}) AS orders,
        (SELECT COUNT(*) FROM cart_items WHERE cart_id=${sqlLiteral(cartId)}) AS cartItems`,
    )[0];

    expect(state).toMatchObject({
      stock: 100,
      customers: 0,
      orders: 0,
      cartItems: 1,
    });
  });

  test("checkout refreshes stale prices, replays idempotently and persists OrderCreated plus outbox", async ({
    request,
  }) => {
    const cartId = await createCart(request);
    const cart = await addTestProduct(request, { clientPriceInCents: 1 });
    expect(cart.items[0].unitPriceInCents).toBe(ORIGINAL_VARIANT_PRICE);

    const updatedServerPrice = 475000000;
    executeLocalD1(
      `UPDATE product_variants SET price_in_cents=${updatedServerPrice} WHERE id=${sqlLiteral(VARIANT_ID)} AND product_id=${sqlLiteral(PRODUCT_ID)}`,
    );

    const email = uniqueEmail();
    const idempotencyKey = randomUUID();
    const forgedClientTotals = {
      subtotalInCents: 1,
      shippingInCents: 0,
      discountInCents: 999999999,
      totalInCents: 1,
      items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 99, unitPriceInCents: 1 }],
    };
    const first = await sendCheckout(request, email, idempotencyKey, forgedClientTotals);
    expect(first.response.status()).toBe(201);
    const firstOrder = ((await first.response.json()) as { order: E2EOrder }).order;

    expect(firstOrder).toMatchObject({
      status: "PENDING_PAYMENT",
      subtotalInCents: updatedServerPrice,
      shippingInCents: 1500000,
      discountInCents: 0,
      totalInCents: updatedServerPrice + 1500000,
    });
    expect(firstOrder.items).toHaveLength(1);
    expect(firstOrder.items[0]).toMatchObject({
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      quantity: 1,
      unitPriceInCents: updatedServerPrice,
      lineTotalInCents: updatedServerPrice,
    });

    const replay = await sendCheckout(request, email, idempotencyKey, forgedClientTotals);
    expect(replay.response.status()).toBe(200);
    const replayOrder = ((await replay.response.json()) as { order: E2EOrder }).order;
    expect(replayOrder.id).toBe(firstOrder.id);

    const orderList = await request.get("/api/orders");
    expect(orderList.status()).toBe(200);
    const listed = (await orderList.json()) as { orders: E2EOrder[] };
    expect(listed.orders.map((order) => order.id)).toContain(firstOrder.id);

    const detail = await request.get(`/api/orders/${firstOrder.id}`);
    expect(detail.status()).toBe(200);

    const persisted = queryLocalD1<{
      status: string;
      subtotal: number;
      shipping: number;
      total: number;
      stock: number;
      orderEvents: number;
      outboxRows: number;
      outboxType: string | null;
      reservations: number;
      activeReservations: number;
      remainingCartItems: number;
    }>(
      `SELECT
        o.status AS status,
        o.subtotal_in_cents AS subtotal,
        o.shipping_in_cents AS shipping,
        o.total_in_cents AS total,
        p.stock AS stock,
        (SELECT COUNT(*) FROM order_events e WHERE e.order_id=o.id AND e.event_type='OrderCreated') AS orderEvents,
        (SELECT COUNT(*) FROM notification_outbox n WHERE n.id=${sqlLiteral(`order-created:${firstOrder.id}`)} AND n.aggregate_id=o.id) AS outboxRows,
        (SELECT event_type FROM notification_outbox n WHERE n.id=${sqlLiteral(`order-created:${firstOrder.id}`)} LIMIT 1) AS outboxType,
        (SELECT COUNT(*) FROM inventory_reservations r WHERE r.order_id=o.id) AS reservations,
        (SELECT COUNT(*) FROM inventory_reservations r WHERE r.order_id=o.id AND r.released_at IS NULL) AS activeReservations,
        (SELECT COUNT(*) FROM cart_items ci WHERE ci.cart_id=${sqlLiteral(cartId)}) AS remainingCartItems
      FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      JOIN products p ON p.id=oi.product_id
      WHERE o.id=${sqlLiteral(firstOrder.id)}
      LIMIT 1`,
    )[0];

    expect(persisted).toMatchObject({
      status: "PENDING_PAYMENT",
      subtotal: updatedServerPrice,
      shipping: 1500000,
      total: updatedServerPrice + 1500000,
      stock: 99,
      orderEvents: 1,
      outboxRows: 1,
      outboxType: "OrderCreated",
      reservations: 1,
      activeReservations: 1,
      remainingCartItems: 0,
    });
  });

  test("customer sessions cannot read or pay another customer's order", async ({
    request,
    playwright,
  }) => {
    const owner = await placeOrder(request);
    const otherCustomer = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const anonymous = await playwright.request.newContext({ baseURL: API_BASE_URL });

    try {
      const other = await placeOrder(otherCustomer);

      const foreignOrder = await otherCustomer.get(`/api/orders/${owner.order.id}`);
      expect(foreignOrder.status()).toBe(404);

      const foreignPaymentIntent = await otherCustomer.post("/api/payments/intent", {
        headers: { "Idempotency-Key": randomUUID() },
        data: { orderId: owner.order.id, paymentProvider: "WOMPI" },
      });
      expect(foreignPaymentIntent.status()).toBe(404);

      const ownOrders = await otherCustomer.get("/api/orders");
      expect(ownOrders.status()).toBe(200);
      const ownOrderIds = ((await ownOrders.json()) as { orders: E2EOrder[] }).orders.map(
        (order) => order.id,
      );
      expect(ownOrderIds).toContain(other.order.id);
      expect(ownOrderIds).not.toContain(owner.order.id);

      expect((await anonymous.get("/api/orders")).status()).toBe(401);
      expect((await anonymous.get("/api/payments/not-a-payment")).status()).toBe(401);
      expect(
        (
          await anonymous.post("/api/payments/not-a-payment/refund", {
            data: {},
          })
        ).status(),
      ).toBe(401);
      expect((await anonymous.get(`/api/orders/${owner.order.id}`)).status()).toBe(404);

      const paymentCount = queryLocalD1<{ count: number }>(
        `SELECT COUNT(*) AS count FROM payments WHERE order_id=${sqlLiteral(owner.order.id)}`,
      )[0].count;
      expect(paymentCount).toBe(0);
    } finally {
      await otherCustomer.dispose();
      await anonymous.dispose();
    }
  });

  test("concurrent checkouts cannot oversell stock or create orphan order reservations", async ({
    request,
    playwright,
  }) => {
    resetCheckoutInventory(1);
    const competitor = await playwright.request.newContext({ baseURL: API_BASE_URL });

    try {
      const firstCartId = await createCart(request);
      const secondCartId = await createCart(competitor);
      await Promise.all([addTestProduct(request), addTestProduct(competitor)]);

      const firstEmail = uniqueEmail();
      const secondEmail = uniqueEmail();
      const [first, second] = await Promise.all([
        sendCheckout(request, firstEmail),
        sendCheckout(competitor, secondEmail),
      ]);

      const statuses = [first.response.status(), second.response.status()].sort();
      expect(statuses).toEqual([201, 409]);

      const winner = first.response.status() === 201 ? first : second;
      const winnerCartId = first.response.status() === 201 ? firstCartId : secondCartId;
      const loserCartId = first.response.status() === 201 ? secondCartId : firstCartId;
      const winnerOrder = ((await winner.response.json()) as { order: E2EOrder }).order;

      const state = queryLocalD1<{
        stock: number;
        orderCount: number;
        orderEventCount: number;
        outboxCount: number;
        reservationCount: number;
      }>(
        `SELECT
          (SELECT stock FROM products WHERE id=${sqlLiteral(PRODUCT_ID)}) AS stock,
          (SELECT COUNT(*) FROM orders WHERE email IN (${sqlLiteral(firstEmail)},${sqlLiteral(secondEmail)})) AS orderCount,
          (SELECT COUNT(*) FROM order_events e JOIN orders o ON o.id=e.order_id WHERE o.email IN (${sqlLiteral(firstEmail)},${sqlLiteral(secondEmail)})) AS orderEventCount,
          (SELECT COUNT(*) FROM notification_outbox n JOIN orders o ON o.id=n.aggregate_id WHERE o.email IN (${sqlLiteral(firstEmail)},${sqlLiteral(secondEmail)})) AS outboxCount,
          (SELECT COUNT(*) FROM inventory_reservations r JOIN orders o ON o.id=r.order_id WHERE o.email IN (${sqlLiteral(firstEmail)},${sqlLiteral(secondEmail)})) AS reservationCount`,
      )[0];

      expect(state).toMatchObject({
        stock: 0,
        orderCount: 1,
        orderEventCount: 1,
        outboxCount: 1,
        reservationCount: 1,
      });

      expect(
        queryLocalD1<{ count: number }>(
          `SELECT COUNT(*) AS count FROM cart_items WHERE cart_id=${sqlLiteral(winnerCartId)}`,
        )[0].count,
      ).toBe(0);
      expect(
        queryLocalD1<{ count: number }>(
          `SELECT COUNT(*) AS count FROM cart_items WHERE cart_id=${sqlLiteral(loserCartId)}`,
        )[0].count,
      ).toBe(1);
      expect(winnerOrder.items[0].quantity).toBe(1);
    } finally {
      await competitor.dispose();
    }
  });
});
