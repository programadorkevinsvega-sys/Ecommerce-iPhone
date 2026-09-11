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
    if (input.shippingMethod !== "PICKUP" && input.shippingMethod !== "DELIVERY") throw new Error("Invalid shipping method");
    if (input.shippingAddress.countryCode !== "CO") throw new Error("Shipping is currently limited to Colombia");
    await this.reservations.releaseExpired();
    return this.orderRepository.checkout(cart, input);
  }
}
