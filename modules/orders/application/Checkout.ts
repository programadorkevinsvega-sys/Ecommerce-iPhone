import type { Cart } from "../../cart/domain/Cart";
import type { CheckoutInput, OrderCheckoutRepository } from "./CheckoutInput";

export class Checkout {
  constructor(private readonly orderRepository: OrderCheckoutRepository) {}

  async execute(cart: Cart, input: CheckoutInput) {
    if (!cart.items.length) throw new Error("Cart is empty");
    if (cart.items.some((item) => item.quantity > item.stock)) throw new Error("One or more products no longer have enough stock");
    if (!input.customerId) throw new Error("Customer authentication is required");
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(input.idempotencyKey)) throw new Error("Invalid checkout idempotency key");
    if (input.shippingMethod !== "PICKUP" && input.shippingMethod !== "DELIVERY") throw new Error("Invalid shipping method");
    if (input.shippingAddress.countryCode !== "CO") throw new Error("Shipping is currently limited to Colombia");
    return this.orderRepository.checkout(cart, input);
  }
}
