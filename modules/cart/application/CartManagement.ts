import { assertCartQuantity, type Cart } from "../domain/Cart";
import type { CartRepository } from "./CartRepository";

export class CartManagement {
  constructor(private readonly repository: CartRepository) {}

  get(cartId: string, customerId?: string): Promise<Cart> {
    return this.repository.getOrCreate(cartId, customerId);
  }

  getOwnedByCustomer(cartId: string, customerId: string): Promise<Cart> {
    return this.repository.getOwnedByCustomer(cartId, customerId);
  }

  claim(cartId: string, customerId: string): Promise<void> {
    return this.repository.claimForCustomer(cartId, customerId);
  }

  async addItemWithMutation(
    input: Readonly<{
      cartId: string;
      productId: string;
      quantity: number;
      variantId?: string;
    }>,
  ): Promise<Readonly<{ cart: Cart; changed: boolean }>> {
    assertCartQuantity(input.quantity);
    await this.repository.getOrCreate(input.cartId);

    const changed = await this.repository.upsertItem(
      input.cartId,
      input.productId,
      input.quantity,
      input.variantId,
    );

    return {
      cart: await this.repository.getOrCreate(input.cartId),
      changed,
    };
  }

  async addItem(
    input: Readonly<{
      cartId: string;
      productId: string;
      quantity: number;
      variantId?: string;
    }>,
  ): Promise<Cart> {
    return (await this.addItemWithMutation(input)).cart;
  }

  async removeItemWithMutation(
    input: Readonly<{
      cartId: string;
      productId: string;
      variantId?: string;
    }>,
  ): Promise<Readonly<{ cart: Cart; changed: boolean }>> {
    const changed = await this.repository.removeItem(
      input.cartId,
      input.productId,
      input.variantId,
    );

    return {
      cart: await this.repository.getOrCreate(input.cartId),
      changed,
    };
  }

  async removeItem(
    input: Readonly<{
      cartId: string;
      productId: string;
      variantId?: string;
    }>,
  ): Promise<Cart> {
    return (await this.removeItemWithMutation(input)).cart;
  }
}
