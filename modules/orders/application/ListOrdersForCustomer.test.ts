import { describe, expect, it } from "vitest";
import type { Order } from "../domain/Order";
import type { OrderRepository } from "./OrderRepository";
import { ListOrdersForCustomer } from "./ListOrdersForCustomer";

const order: Order = {
  id: "order-1",
  orderNumber: "EIP-2026-ORDER",
  customerId: "customer-1",
  email: "customer@example.com",
  status: "PENDING_PAYMENT",
  currency: "COP",
  subtotalInCents: 100000,
  shippingInCents: 0,
  discountInCents: 0,
  totalInCents: 100000,
  shippingMethod: "PICKUP",
  shippingAddress: {
    recipientName: "Customer",
    phone: "3000000000",
    addressLine1: "Calle 1",
    city: "Medellín",
    state: "Antioquia",
    countryCode: "CO",
  },
  items: [],
};

class Orders implements OrderRepository {
  async findById(): Promise<Order | null> {
    return order;
  }

  async listByCustomer(customerId: string, limit: number, offset: number): Promise<readonly Order[]> {
    expect(customerId).toBe("customer-1");
    expect(limit).toBe(50);
    expect(offset).toBe(3);
    return [order];
  }
}

describe("ListOrdersForCustomer", () => {
  it("requires an authenticated customer", async () => {
    await expect(new ListOrdersForCustomer(new Orders()).execute("")).rejects.toThrow("Customer authentication is required");
  });

  it("clamps pagination and preserves ownership at the application boundary", async () => {
    const page = await new ListOrdersForCustomer(new Orders()).execute("customer-1", 500, 3);
    expect(page).toEqual({ items: [order], limit: 50, offset: 3 });
  });

  it("normalizes negative and fractional pagination", async () => {
    const repository: OrderRepository = {
      findById: async () => order,
      listByCustomer: async (_customerId, limit, offset) => {
        expect(limit).toBe(1);
        expect(offset).toBe(0);
        return [];
      },
    };
    await new ListOrdersForCustomer(repository).execute("customer-1", 0.9, -3.8);
  });
});
