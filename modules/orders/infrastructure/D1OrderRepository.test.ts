import { afterEach, describe, expect, it } from "vitest";
import type { CheckoutCart } from "../application/CheckoutCart";
import type { CheckoutInput } from "../application/CheckoutInput";
import { D1OrderRepository } from "./D1OrderRepository";
import { D1SqliteTestDatabase } from "./D1SqliteTestDatabase";

const cart: CheckoutCart = {
  id: "cart-1",
  customerId: "customer-1",
  currency: "COP",
  items: [
    {
      productId: "product-1",
      productName: "iPhone",
      slug: "iphone",
      quantity: 1,
      unitPriceInCents: 100000,
      currency: "COP",
      stock: 10,
    },
  ],
};

const input: CheckoutInput = {
  customerId: "customer-1",
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
  email: "customer@example.com",
  shippingMethod: "PICKUP",
  shippingAddress: {
    recipientName: "Customer",
    phone: "3000000000",
    addressLine1: "Calle 1",
    city: "Medellín",
    state: "Antioquia",
    countryCode: "CO",
  },
};

let database: D1SqliteTestDatabase;

afterEach(() => database.close());

describe("D1OrderRepository checkout concurrency", () => {
  it("creates exactly one order when the same idempotency key races concurrently", async () => {
    database = createDatabase(10);
    const repository = new D1OrderRepository(database.asD1());

    const [first, second] = await Promise.all([
      repository.checkout(cart, input),
      repository.checkout(cart, input),
    ]);

    expect(first.id).toBe(second.id);
    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM orders")[0].count).toBe(1);
    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM checkout_idempotency")[0].count).toBe(1);
    expect(database.query<{ stock: number }>("SELECT stock FROM products WHERE id='product-1'")[0].stock).toBe(9);
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM inventory_reservations WHERE released_at IS NULL")[0].count,
    ).toBe(1);
  });

  it("allows only one checkout to win when two different keys race for the last unit", async () => {
    database = createDatabase(1);
    const repository = new D1OrderRepository(database.asD1());

    const results = await Promise.allSettled([
      repository.checkout(cart, { ...input, idempotencyKey: "aaaaaaaaaaaaaaaa" }),
      repository.checkout(cart, { ...input, idempotencyKey: "bbbbbbbbbbbbbbbb" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM orders")[0].count).toBe(1);
    expect(database.query<{ stock: number }>("SELECT stock FROM products WHERE id='product-1'")[0].stock).toBe(0);
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM inventory_reservations WHERE released_at IS NULL")[0].count,
    ).toBe(1);
    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM checkout_idempotency")[0].count).toBe(1);
  });

  it("never lets the same idempotency key cross customer ownership", async () => {
    database = createDatabase(3);
    const repository = new D1OrderRepository(database.asD1());

    await repository.checkout(cart, input);
    await expect(
      repository.checkout(cart, { ...input, customerId: "customer-2", email: "other@example.com" }),
    ).rejects.toThrow("Idempotency key belongs to another customer");

    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM orders")[0].count).toBe(1);
    expect(database.query<{ stock: number }>("SELECT stock FROM products WHERE id='product-1'")[0].stock).toBe(2);
  });

  it("reuses an expired idempotency key for a new checkout", async () => {
    database = createDatabase(2);
    const repository = new D1OrderRepository(database.asD1());

    database.exec(
      "INSERT INTO orders(id,order_number,customer_id,email,status,currency,subtotal_in_cents,shipping_in_cents,discount_in_cents,total_in_cents,shipping_method,shipping_recipient_name,shipping_phone,shipping_address_line1,shipping_city,shipping_state,shipping_country_code) VALUES('old-order','EIP-OLD','customer-1','customer@example.com','CANCELLED','COP',100000,0,0,100000,'PICKUP','Customer','3000000000','Calle 1','Medellín','Antioquia','CO')",
    );
    database.exec(
      "INSERT INTO checkout_idempotency(idempotency_key,customer_id,order_id,expires_at) VALUES('550e8400-e29b-41d4-a716-446655440000','customer-1','old-order',datetime('now','-1 minute'))",
    );

    const order = await repository.checkout(cart, input);

    expect(order.id).not.toBe("old-order");
    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM checkout_idempotency")[0].count).toBe(1);
    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM orders")[0].count).toBe(2);
  });
});

function createDatabase(stock: number): D1SqliteTestDatabase {
  database = new D1SqliteTestDatabase();
  database.exec(
    "INSERT INTO products(id,name,slug,active,price_in_cents,currency,stock) VALUES('product-1','iPhone','iphone',1,100000,'COP',?)",
    stock,
  );
  database.exec("INSERT INTO carts(id,customer_id,currency) VALUES('cart-1','customer-1','COP')");
  database.exec("INSERT INTO cart_items(cart_id,product_id,quantity,unit_price_in_cents) VALUES('cart-1','product-1',1,100000)");
  return database;
}
