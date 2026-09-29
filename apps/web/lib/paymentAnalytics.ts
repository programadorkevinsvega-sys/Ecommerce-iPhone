import { analyticsApp } from "./analyticsApplication";
import { cloudflareEnv } from "./cloudflareContext";
import type { ProviderTransaction } from "../../../modules/payments/application/PaymentPorts";
import type { Payment } from "../../../modules/payments/domain/Payment";
import type { D1OrderRepository } from "../../../modules/orders/infrastructure/D1OrderRepository";
import type { D1PaymentRepository } from "../../../modules/payments/infrastructure/D1PaymentRepository";
import { waitUntil } from "cloudflare:workers";

type PaymentRepositories = Readonly<{
  payments: D1PaymentRepository;
  orders: D1OrderRepository;
}>;

export function recordPurchaseCompleted(
  repositories: PaymentRepositories,
  transaction: ProviderTransaction,
): void {
  waitUntil(
    recordPurchaseCompletedNow(repositories, transaction).catch(() => undefined),
  );
}

async function recordPurchaseCompletedNow(
  repositories: PaymentRepositories,
  transaction: ProviderTransaction,
): Promise<void> {
  if (transaction.status !== "APPROVED") return;

  const payment =
    (await repositories.payments.findByProviderReference(transaction.reference)) ??
    (await repositories.payments.findByProviderTransactionId(transaction.transactionId)) ??
    (await repositories.payments.findByOrderId(transaction.reference));

  if (!payment || payment.status !== "PAID") return;

  const order = await repositories.orders.findById(payment.orderId);
  if (!order || order.status !== "PAID") return;

  const customerId = order.customerId ?? payment.customerId;
  if (!customerId) return;

  await analyticsApp(cloudflareEnv()).record({
    eventId: `purchase-completed:${payment.id}`,
    eventType: "PurchaseCompleted",
    occurredAt: new Date().toISOString(),
    sessionId: `order:${order.id}`,
    visitorId: `customer:${customerId}`,
    payload: {
      orderId: order.id,
      paymentId: payment.id,
      provider: payment.provider,
      transactionId: transaction.transactionId,
      amountInCents: order.totalInCents,
      currency: order.currency,
    },
    source: "server",
  });
}
