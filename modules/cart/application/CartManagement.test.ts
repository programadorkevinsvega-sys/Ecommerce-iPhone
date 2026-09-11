import { describe, expect, it } from "vitest";
import { CartManagement } from "./CartManagement";
import type { CartRepository } from "./CartRepository";
import type { Cart } from "../domain/Cart";

const cart: Cart = { id: "cart-1", customerId: "customer-1", currency: "COP", items: [] };

class Repository implements CartRepository {
  ownedCalls: Array<[string, string]> = [];
  async getOrCreate(): Promise<Cart> { return cart; }
  async claimForCustomer(): Promise<void> {}
  async getOwnedByCustomer(cartId: string, customerId: string): Promise<Cart> {
    this.ownedCalls.push([cartId, customerId]);
    return cart;
  }
  async upsertItem(): Promise<void> {}
  async removeItem(): Promise<void> {}
}

describe("CartManagement", () => {
  it("requires an explicit customer identity for owned-cart reads", async () => {
    const repository = new Repository();
    const management = new CartManagement(repository);
    const result = await management.getOwnedByCustomer("cart-1", "customer-1");
    expect(result.customerId).toBe("customer-1");
    expect(repository.ownedCalls).toEqual([["cart-1", "customer-1"]]);
  });
});
