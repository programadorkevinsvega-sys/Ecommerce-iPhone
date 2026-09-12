import { afterEach, describe, expect, it } from "vitest";
import { D1ReservationRepository } from "./D1ReservationRepository";
import { D1SqliteTestDatabase } from "./D1SqliteTestDatabase";

let database: D1SqliteTestDatabase;

afterEach(() => database.close());

describe("D1ReservationRepository concurrency", () => {
  it("releases an expired reservation exactly once under concurrent cleanup", async () => {
    database = createDatabase();
    const repository = new D1ReservationRepository(database.asD1());

    const results = await Promise.all([repository.releaseExpired(), repository.releaseExpired()]);

    expect(results.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(database.query<{ stock: number }>("SELECT stock FROM products WHERE id='product-1'")[0].stock).toBe(1);
    expect(database.query<{ released_at: string | null }>("SELECT released_at FROM inventory_reservations WHERE id='reservation-1'")[0].released_at).not.toBeNull();
  });

  it("does not return stock twice when order cancellation races with reservation cleanup", async () => {
    database = createDatabase("CANCELLED");
    const repository = new D1ReservationRepository(database.asD1());

    const results = await Promise.all([
      repository.releaseExpired(),
      repository.releaseForOrder("order-1"),
    ]);

    expect(results.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(database.query<{ stock: number }>("SELECT stock FROM products WHERE id='product-1'")[0].stock).toBe(1);
    expect(database.query<{ count: number }>("SELECT COUNT(*) AS count FROM inventory_reservations WHERE released_at IS NULL")[0].count).toBe(0);
  });

  it("does not restore stock for a terminal paid reservation that has already been consumed", async () => {
    database = createDatabase("PAID");
    const repository = new D1ReservationRepository(database.asD1());

    await expect(repository.releaseExpired()).resolves.toBe(1);
    expect(database.query<{ stock: number }>("SELECT stock FROM products WHERE id='product-1'")[0].stock).toBe(0);
    expect(database.query<{ released_at: string | null }>("SELECT released_at FROM inventory_reservations WHERE id='reservation-1'")[0].released_at).not.toBeNull();
  });

  it("keeps a non-expired payment reservation untouched", async () => {
    database = createDatabase("PENDING_PAYMENT", false);
    const repository = new D1ReservationRepository(database.asD1());

    await expect(repository.releaseExpired()).resolves.toBe(0);
    expect(database.query<{ stock: number }>("SELECT stock FROM products WHERE id='product-1'")[0].stock).toBe(0);
    expect(database.query<{ released_at: string | null }>("SELECT released_at FROM inventory_reservations WHERE id='reservation-1'")[0].released_at).toBeNull();
  });
});

function createDatabase(orderStatus = "PENDING_PAYMENT", expired = true): D1SqliteTestDatabase {
  database = new D1SqliteTestDatabase();
  database.exec(
    "INSERT INTO products(id,name,slug,active,price_in_cents,currency,stock) VALUES('product-1','iPhone','iphone',1,100000,'COP',0)",
  );
  database.exec("INSERT INTO carts(id,customer_id,currency) VALUES('cart-1','customer-1','COP')");
  database.exec(
    "INSERT INTO orders(id,order_number,customer_id,email,status,currency,subtotal_in_cents,shipping_in_cents,discount_in_cents,total_in_cents,shipping_method,shipping_recipient_name,shipping_phone,shipping_address_line1,shipping_city,shipping_state,shipping_country_code) VALUES('order-1','EIP-1','customer-1','customer@example.com',?,'COP',100000,0,0,100000,'PICKUP','Customer','3000000000','Calle 1','Medellín','Antioquia','CO')",
    orderStatus,
  );
  database.exec(
    "INSERT INTO inventory_reservations(id,cart_id,product_id,quantity,expires_at,order_id) VALUES('reservation-1','cart-1','product-1',1,?, 'order-1')",
    expired ? "2000-01-01 00:00:00" : "2999-01-01 00:00:00",
  );
  return database;
}
