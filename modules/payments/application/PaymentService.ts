import type { Payment } from "../domain/Payment";
import { assertPaymentTransition } from "../domain/Payment";
import type { CreatePaymentInput, OrderPaymentPort, PaymentProviderPort, PaymentRepository, ProviderTransaction, ReservationPaymentPort } from "./PaymentPorts";

export class PaymentService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly provider: PaymentProviderPort,
    private readonly orders: OrderPaymentPort,
    private readonly reservations: ReservationPaymentPort,
  ) {}

  async createIntent(input: CreatePaymentInput): Promise<Readonly<{ payment: Payment; checkout: Awaited<ReturnType<PaymentProviderPort["createPaymentIntent"]>> }>> {
    const existing = await this.payments.findByIdempotencyKey(input.customerId, input.idempotencyKey);
    if (existing) {
      this.assertOrderMatches(existing, input);
      if (existing.provider !== this.provider.provider) throw new Error("Payment provider does not match the existing idempotent payment");
      const checkout = existing.checkoutUrl
        ? { providerReference: existing.providerReference, provider: existing.provider, publicKey: "", currency: existing.currency, amountInCents: existing.amountInCents, integritySignature: "", checkoutUrl: existing.checkoutUrl }
        : await this.provider.recoverPaymentIntent(existing, input);
      await this.reservations.extendForOrder(input.orderId, 30);
      return { payment: existing, checkout };
    }

    const order = await this.orders.findById(input.orderId);
    if (!order) throw new Error("Order not found");
    if (order.customerId !== input.customerId) throw new Error("Order does not belong to customer");
    if (order.status !== "PENDING_PAYMENT") throw new Error("Order is not awaiting payment");
    if (order.totalInCents !== input.amountInCents || order.currency !== input.currency) throw new Error("Payment amount or currency does not match order");

    const checkout = await this.provider.createPaymentIntent(input);
    if (checkout.provider !== this.provider.provider || checkout.amountInCents !== input.amountInCents || checkout.currency !== input.currency) throw new Error("Payment provider returned an inconsistent payment intent");

    const now = new Date().toISOString();
    const payment: Payment = {
      id: crypto.randomUUID(), orderId: input.orderId, customerId: input.customerId, provider: checkout.provider,
      providerReference: checkout.providerReference, ...(checkout.checkoutUrl ? { checkoutUrl: checkout.checkoutUrl } : {}),
      status: "PENDING", amountInCents: checkout.amountInCents, currency: checkout.currency,
      idempotencyKey: input.idempotencyKey, createdAt: now, updatedAt: now,
    };

    try {
      await this.payments.create(payment);
    } catch (error) {
      const raced = await this.payments.findByIdempotencyKey(input.customerId, input.idempotencyKey);
      if (raced) {
        this.assertOrderMatches(raced, input);
        if (raced.provider !== this.provider.provider) throw new Error("Concurrent payment selected a different provider");
        const recovered = raced.checkoutUrl
          ? { providerReference: raced.providerReference, provider: raced.provider, publicKey: "", currency: raced.currency, amountInCents: raced.amountInCents, integritySignature: "", checkoutUrl: raced.checkoutUrl }
          : await this.provider.recoverPaymentIntent(raced, input);
        await this.reservations.extendForOrder(input.orderId, 30);
        return { payment: raced, checkout: recovered };
      }
      throw error;
    }

    await this.reservations.extendForOrder(input.orderId, 30);
    await this.payments.recordLedger(payment.id, "PAYMENT_INTENT_CREATED", payment.amountInCents, payment.currency, JSON.stringify({ provider: payment.provider, reference: payment.providerReference }));
    return { payment, checkout };
  }

  async processProviderTransaction(transaction: ProviderTransaction, rawEvent: string): Promise<void> {
    const payment = await this.payments.findByProviderReference(transaction.reference);
    if (!payment) return;
    if (payment.provider !== this.provider.provider) throw new Error("Provider mismatch");
    if (payment.amountInCents !== transaction.amountInCents || payment.currency !== transaction.currency) {
      await this.payments.recordLedger(payment.id, "SECURITY_MISMATCH", transaction.amountInCents, transaction.currency, JSON.stringify({ transactionId: transaction.transactionId }));
      throw new Error("Provider transaction does not match payment intent");
    }
    await this.payments.recordWebhook(payment.provider, this.eventId(transaction, rawEvent), rawEvent);
    await this.payments.attachProviderTransaction(payment.id, transaction.transactionId);
    if (transaction.status === "APPROVED") return this.markPaid(payment);
    if (transaction.status === "DECLINED" || transaction.status === "ERROR") return this.markFailed(payment);
    if (transaction.status === "VOIDED") return this.markCancelled(payment);
    if (payment.status === "PENDING") await this.payments.transition(payment.id, "PENDING", "PROCESSING");
  }

  async reconcile(transactionId: string): Promise<ProviderTransaction> {
    const transaction = await this.provider.getTransaction(transactionId);
    await this.processProviderTransaction(transaction, JSON.stringify({ source: "reconciliation", transaction }));
    return transaction;
  }

  private async markPaid(payment: Payment): Promise<void> {
    if (payment.status === "PAID") return;
    if (!["PENDING", "PROCESSING"].includes(payment.status)) return;
    const order = await this.orders.findById(payment.orderId);
    if (!order) throw new Error("Order not found while confirming payment");
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      await this.payments.recordLedger(payment.id, "LATE_APPROVAL_AFTER_ORDER_CLOSED", payment.amountInCents, payment.currency, JSON.stringify({ transactionId: payment.providerTransactionId }));
      return;
    }
    if (order.status !== "PAID") {
      const orderChanged = await this.orders.transitionStatus(payment.orderId, "PENDING_PAYMENT", "PAID") || await this.orders.transitionStatus(payment.orderId, "PAYMENT_PROCESSING", "PAID");
      if (!orderChanged) {
        const current = await this.orders.findById(payment.orderId);
        if (current?.status !== "PAID") throw new Error("Payment confirmed but order transition failed");
      }
    }
    assertPaymentTransition(payment.status, "PAID");
    const changed = await this.payments.transition(payment.id, payment.status, "PAID");
    if (!changed) {
      const current = await this.payments.findById(payment.id);
      if (current?.status === "PAID") return;
      throw new Error("Concurrent payment transition prevented confirmation");
    }
    await this.reservations.consumeForOrder(payment.orderId);
    await this.payments.recordLedger(payment.id, "PAYMENT_CONFIRMED", payment.amountInCents, payment.currency, "{}");
  }

  private async markFailed(payment: Payment): Promise<void> {
    if (["FAILED", "CANCELLED"].includes(payment.status) || !["PENDING", "PROCESSING"].includes(payment.status)) return;
    if (!(await this.payments.transition(payment.id, payment.status, "FAILED"))) return;
    const orderChanged = await this.orders.transitionStatus(payment.orderId, "PENDING_PAYMENT", "CANCELLED") || await this.orders.transitionStatus(payment.orderId, "PAYMENT_PROCESSING", "CANCELLED");
    if (!orderChanged) {
      const order = await this.orders.findById(payment.orderId);
      if (order && order.status !== "CANCELLED") throw new Error("Payment failed but order cancellation failed");
    }
    await this.reservations.releaseForOrder(payment.orderId);
    await this.payments.recordLedger(payment.id, "PAYMENT_FAILED", 0, payment.currency, "{}");
  }

  private async markCancelled(payment: Payment): Promise<void> {
    if (["FAILED", "CANCELLED"].includes(payment.status) || !["PENDING", "PROCESSING"].includes(payment.status)) return;
    if (!(await this.payments.transition(payment.id, payment.status, "CANCELLED"))) return;
    await this.orders.transitionStatus(payment.orderId, "PENDING_PAYMENT", "CANCELLED");
    await this.orders.transitionStatus(payment.orderId, "PAYMENT_PROCESSING", "CANCELLED");
    await this.reservations.releaseForOrder(payment.orderId);
    await this.payments.recordLedger(payment.id, "PAYMENT_CANCELLED", 0, payment.currency, "{}");
  }

  private assertOrderMatches(payment: Payment, input: CreatePaymentInput): void {
    if (payment.orderId !== input.orderId || payment.amountInCents !== input.amountInCents || payment.currency !== input.currency) throw new Error("Idempotency key is bound to a different payment");
  }

  private eventId(transaction: ProviderTransaction, rawEvent: string): string {
    return `${transaction.transactionId}:${transaction.status}:${this.simpleHash(rawEvent)}`;
  }

  private simpleHash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}
