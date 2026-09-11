import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1CartRepository } from "../../../modules/cart/infrastructure/D1CartRepository";
import { CartManagement } from "../../../modules/cart/application/CartManagement";
import { D1CustomerRepository } from "../../../modules/customers/infrastructure/D1CustomerRepository";
import { CustomerManagement } from "../../../modules/customers/application/CustomerManagement";
import { D1OrderRepository } from "../../../modules/orders/infrastructure/D1OrderRepository";
import { D1ReservationRepository } from "../../../modules/orders/infrastructure/D1ReservationRepository";
import { Checkout } from "../../../modules/orders/application/Checkout";

export async function commerceContext() {
  const { env } = getCloudflareContext();
  const cartRepository = new D1CartRepository(env.DB);
  const customerRepository = new D1CustomerRepository(env.DB);
  return {
    db: env.DB,
    cart: new CartManagement(cartRepository),
    customer: new CustomerManagement(customerRepository),
    cartRepository,
    customerRepository,
    orderRepository: new D1OrderRepository(env.DB),
  };
}

export async function checkoutUseCase() {
  const context = await commerceContext();
  const checkout = new Checkout(new D1ReservationRepository(context.db), context.orderRepository);
  return { context, checkout };
}
