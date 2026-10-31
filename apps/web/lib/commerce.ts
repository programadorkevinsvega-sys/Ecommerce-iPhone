import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CartManagement } from "../../../modules/cart/application/CartManagement";
import { D1CartRepository } from "../../../modules/cart/infrastructure/D1CartRepository";
import { CustomerManagement } from "../../../modules/customers/application/CustomerManagement";
import { CustomerSessionService } from "../../../modules/customers/application/CustomerSession";
import { D1CustomerRepository } from "../../../modules/customers/infrastructure/D1CustomerRepository";
import { D1CustomerSessionRepository } from "../../../modules/customers/infrastructure/D1CustomerSessionRepository";
import { D1CustomerSecurityAuditRepository } from "../../../modules/customers/infrastructure/D1CustomerSecurityAuditRepository";
import { WebCryptoCustomerSessionTokenGenerator } from "../../../modules/customers/infrastructure/WebCryptoCustomerSessionTokenGenerator";
import { CustomerDeviceService } from "../../../modules/customers/application/CustomerDeviceService";
import { D1CustomerDeviceRepository } from "../../../modules/customers/infrastructure/D1CustomerDeviceRepository";
import { Checkout } from "../../../modules/orders/application/Checkout";
import { D1OrderRepository } from "../../../modules/orders/infrastructure/D1OrderRepository";
import { D1OrderIdempotencyLookup } from "../../../modules/orders/infrastructure/D1OrderIdempotencyLookup";
import { D1ReservationRepository } from "../../../modules/orders/infrastructure/D1ReservationRepository";
import { D1CustomerPortalRepository } from "../../../modules/customers/infrastructure/D1CustomerPortalRepository";
import { D1NotificationOutboxRepository } from "../../../modules/notifications/infrastructure/D1NotificationOutboxRepository";

export async function commerceContext() {
  const { env } = getCloudflareContext();
  const cartRepository = new D1CartRepository(env.DB);
  const customerRepository = new D1CustomerRepository(env.DB);
  const customerSessionRepository = new D1CustomerSessionRepository(env.DB);
  const customerSecurityAudit = new D1CustomerSecurityAuditRepository(env.DB);
  const notificationOutbox = new D1NotificationOutboxRepository(env.DB);
  const orderRepository = new D1OrderRepository(env.DB, (order, createdAt) =>
    notificationOutbox.prepareEnqueue({
      id: `order-created:${order.id}`,
      eventType: "OrderCreated",
      eventVersion: 1,
      aggregateId: order.id,
      payload: {
        email: order.email,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalInCents: order.totalInCents,
        currency: order.currency,
      },
      createdAt,
    }),
  );
  return {
    db: env.DB,
    cart: new CartManagement(cartRepository),
    customer: new CustomerManagement(customerRepository),
    customerSession: new CustomerSessionService(
      customerSessionRepository,
      new WebCryptoCustomerSessionTokenGenerator(),
    ),
    customerSecurityAudit,
    cartRepository,
    customerRepository,
    customerDevices: new CustomerDeviceService(new D1CustomerDeviceRepository(env.DB)),
    customerPortal: new D1CustomerPortalRepository(env.DB),
    orderRepository,
    orderIdempotency: new D1OrderIdempotencyLookup(env.DB, orderRepository),
  };
}

export async function checkoutUseCase() {
  const context = await commerceContext();
  const checkout = new Checkout(new D1ReservationRepository(context.db), context.orderRepository);
  return { context, checkout };
}
