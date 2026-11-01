import { describe, expect, it } from "vitest";
import { CartManagement } from "./CartManagement";
import type { CartRepository } from "./CartRepository";
import type { Cart } from "../domain/Cart";

const cart: Cart = { id: "cart-1", customerId: "customer-1", currency: "COP", items: [] };

class Repository implements CartRepository {
  ownedCalls: Array<[string, string]> = [];
  nextAddChanged = true;
  nextRemoveChanged = true;

  async getOrCreate(): Promise<Cart> {
    return cart;
  }

  async claimForCustomer(): Promise<void> {}

  async getOwnedByCustomer(cartId: string, customerId: string): Promise<Cart> {
    this.ownedCalls.push([cartId, customerId]);
    return cart;
  }

  async upsertItem(): Promise<boolean> {
    return this.nextAddChanged;
  }

  async removeItem(): Promise<boolean> {
    return this.nextRemoveChanged;
  }
}

describe("CartManagement", () => {
  it("requires an explicit customer identity for owned-cart reads", async () => {
    const repository = new Repository();
    const management = new CartManagement(repository);
    const result = await management.getOwnedByCustomer("cart-1", "customer-1");
    expect(result.customerId).toBe("customer-1");
    expect(repository.ownedCalls).toEqual([["cart-1", "customer-1"]]);
  });

  it("reports whether an add or remove actually mutated a row", async () => {
    const repository = new Repository();
    const management = new CartManagement(repository);

    const added = await management.addItemWithMutation({
      cartId: "cart-1",
      productId: "product-1",
      quantity: 1,
    });
    expect(added.changed).toBe(true);

    repository.nextRemoveChanged = false;
    const removed = await management.removeItemWithMutation({
      cartId: "cart-1",
      productId: "product-1",
    });
    expect(removed.changed).toBe(false);
  });
});
