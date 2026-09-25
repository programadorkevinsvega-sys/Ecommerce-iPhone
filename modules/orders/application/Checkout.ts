import type { Cart } from "../../cart/domain/Cart";
import type { CheckoutInput, OrderCheckoutRepository } from "./CheckoutInput";
import type { ReservationRepository } from "./ReservationRepository";

export class Checkout {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly orderRepository: OrderCheckoutRepository,
  ) {}

  async execute(cart: Cart, input: CheckoutInput) {
    if (!cart.items.length) throw new Error("Cart is empty");
    if (cart.items.some((item) => item.quantity > item.stock)) throw new Error("One or more products no longer have enough stock");
    if (!input.customerId) throw new Error("Customer authentication is required");
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(input.idempotencyKey)) throw new Error("Invalid checkout idempotency key");
    if (input.shippingMethod !== "PICKUP" && input.shippingMethod !== "DELIVERY") throw new Error("Invalid shipping method");
    if (input.shippingAddress.countryCode !== "CO") throw new Error("Shipping is currently limited to Colombia");
    for (const code of [input.promotionCode, input.couponCode]) {
      if (code !== undefined && !/^[A-Z0-9_-]{3,64}$/.test(code.trim().toUpperCase())) throw new Error("Invalid discount code");
    }
    await this.reservations.releaseExpired();
    return this.orderRepository.checkout(cart, {
      ...input,
      ...(input.promotionCode ? { promotionCode: input.promotionCode.trim().toUpperCase() } : {}),
      ...(input.couponCode ? { couponCode: input.couponCode.trim().toUpperCase() } : {}),
    });
  }
}
