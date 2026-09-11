import { assertCartQuantity, type Cart } from "../domain/Cart";
import type { CartRepository } from "./CartRepository";

export class CartManagement {
  constructor(private readonly repository: CartRepository) {}

  get(cartId: string, customerId?: string): Promise<Cart> {
    return this.repository.getOrCreate(cartId, customerId);
  }

  async addItem(input: Readonly<{ cartId: string; productId: string; quantity: number; variantId?: string }>): Promise<Cart> {
    assertCartQuantity(input.quantity);
    await this.repository.upsertItem(input.cartId, input.productId, input.quantity, input.variantId);
    return this.repository.getOrCreate(input.cartId);
  }

  async removeItem(input: Readonly<{ cartId: string; productId: string; variantId?: string }>): Promise<Cart> {
    await this.repository.removeItem(input.cartId, input.productId, input.variantId);
    return this.repository.getOrCreate(input.cartId);
  }
}
