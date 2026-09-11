import type { Cart } from "../domain/Cart";

export interface CartRepository {
  getOrCreate(cartId: string, customerId?: string): Promise<Cart>;
  claimForCustomer(cartId: string, customerId: string): Promise<void>;
  upsertItem(cartId: string, productId: string, quantity: number, variantId?: string): Promise<void>;
  removeItem(cartId: string, productId: string, variantId?: string): Promise<void>;
}
