import type { CheckoutCart } from "./CheckoutCart";
import type { ShippingAddress, Order } from "../domain/Order";

export type CheckoutInput = Readonly<{
  email: string;
  shippingAddress: ShippingAddress;
  shippingMethod: "PICKUP" | "DELIVERY";
  customerId?: string | undefined;
}>;

export interface OrderCheckoutRepository {
  checkout(cart: CheckoutCart, input: CheckoutInput): Promise<Order>;
}
