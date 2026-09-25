import { describe, expect, it } from "vitest";
import type { Cart } from "../../cart/domain/Cart";
import { Checkout } from "./Checkout";
import type { CheckoutInput, OrderCheckoutRepository } from "./CheckoutInput";
import type { ReservationRepository } from "./ReservationRepository";

const cart: Cart = {
  id: "cart-1",
  customerId: "customer-1",
  currency: "COP",
  items: [{ productId: "product-1", productName: "iPhone", slug: "iphone", quantity: 1, unitPriceInCents: 100000, currency: "COP", stock: 10 }],
};

const input: CheckoutInput = {
  customerId: "customer-1",
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
  email: "customer@example.com",
  shippingMethod: "PICKUP",
  shippingAddress: { recipientName: "Customer", phone: "3000000000", addressLine1: "Calle 1", city: "Medellín", state: "Antioquia", countryCode: "CO" },
};

class Reservations implements ReservationRepository {
  released = false;
  async releaseExpired(): Promise<number> { this.released = true; return 0; }
  async releaseForOrder(): Promise<number> { return 0; }
  async consumeForOrder(): Promise<number> { return 0; }
}

class Orders implements OrderCheckoutRepository {
  called = false;
  async checkout(): Promise<{id:string}> {
    this.called = true;
    return { id: "order-1" };
  }
}

function createCheckout(orders: Orders, reservations = new Reservations()): Checkout {
  return new Checkout(reservations, orders);
}

describe("Checkout", () => {
  it("requires authenticated customer identity and a valid idempotency key", async () => {
    const orders = new Orders();
    const checkout = createCheckout(orders);
    await expect(checkout.execute(cart, { ...input, customerId: "" })).rejects.toThrow("Customer authentication is required");
    await expect(checkout.execute(cart, { ...input, idempotencyKey: "short" })).rejects.toThrow("Invalid checkout idempotency key");
    expect(orders.called).toBe(false);
  });

  it("rejects stale cart stock before entering the checkout repository", async () => {
    const orders = new Orders();
    const checkout = createCheckout(orders);
    await expect(checkout.execute({ ...cart, items: [{ ...cart.items[0], quantity: 11 }] }, input)).rejects.toThrow("enough stock");
    expect(orders.called).toBe(false);
  });

  it("validates shipping policy before checkout", async () => {
    const orders = new Orders();
    const checkout = createCheckout(orders);
    await expect(checkout.execute(cart, { ...input, shippingMethod: "INVALID" as CheckoutInput["shippingMethod"] })).rejects.toThrow("Invalid shipping method");
    await expect(checkout.execute(cart, { ...input, shippingAddress: { ...input.shippingAddress, countryCode: "US" } })).rejects.toThrow("limited to Colombia");
    expect(orders.called).toBe(false);
  });

  it("releases expired reservations before entering checkout", async () => {
    const orders = new Orders();
    const reservations = new Reservations();
    await createCheckout(orders, reservations).execute(cart, input);
    expect(reservations.released).toBe(true);
    expect(orders.called).toBe(true);
  });

  it("delegates a valid checkout exactly once", async () => {
    const orders = new Orders();
    const checkout = createCheckout(orders);
    const result = await checkout.execute(cart, input);
    expect(orders.called).toBe(true);
    expect(result.id).toBe("order-1");
  });
});
