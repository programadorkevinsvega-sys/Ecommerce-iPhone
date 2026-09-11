import { describe, expect, it } from "vitest";
import { Checkout } from "./Checkout";
import type { CheckoutCart } from "./CheckoutCart";
import type { CheckoutInput, OrderCheckoutRepository } from "./CheckoutInput";
import type { ReservationRepository } from "./ReservationRepository";

const cart: CheckoutCart = {
  id: "cart-1",
  currency: "COP",
  items: [{ productId: "product-1", productName: "iPhone", slug: "iphone", quantity: 1, unitPriceInCents: 100000 }],
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
}

class Orders implements OrderCheckoutRepository {
  called = false;
  async checkout(): Promise<any> { this.called = true; return { id: "order-1" }; }
}

describe("Checkout", () => {
  it("requires authenticated customer identity and a valid idempotency key", async () => {
    const reservations = new Reservations();
    const orders = new Orders();
    const checkout = new Checkout(reservations, orders);
    await expect(checkout.execute(cart, { ...input, customerId: "" })).rejects.toThrow("Customer authentication is required");
    await expect(checkout.execute(cart, { ...input, idempotencyKey: "short" })).rejects.toThrow("Invalid checkout idempotency key");
    expect(orders.called).toBe(false);
  });

  it("releases expired reservations before checkout", async () => {
    const reservations = new Reservations();
    const orders = new Orders();
    await new Checkout(reservations, orders).execute(cart, input);
    expect(reservations.released).toBe(true);
    expect(orders.called).toBe(true);
  });
});
