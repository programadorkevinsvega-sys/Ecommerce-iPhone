import type { Payment } from "../domain/Payment";
import { assertPaymentTransition } from "../domain/Payment";
import type {
  CreatePaymentInput,
  OrderPaymentPort,
  PaymentProviderPort,
  PaymentRepository,
  ProviderTransaction,
  ReservationPaymentPort,
} from "./PaymentPorts";
import { PaymentProviderRegistry } from "./PaymentProviderRegistry";

type StoredRefund = NonNullable<Awaited<ReturnType<PaymentRepository["findRefund"]>>>;

export class PaymentService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly orders: OrderPaymentPort,
    private readonly reservations: ReservationPaymentPort,
  ) {}

  async getPayment(id: string, customerId?: string): Promise<Payment | null> {
    const payment = await this.payments.findById(id);
    if (!payment || (customerId && payment.customerId !== customerId)) return null;
    return payment;
  }

  async createIntent(
    providerName: ProviderTransaction["provider"],
    input: CreatePaymentInput,
  ): Promise<
    Readonly<{
      payment: Payment;
      checkout: Awaited<ReturnType<PaymentProviderPort["createPaymentIntent"]>>;
    }>
  > {
    const provider = this.providers.resolve(providerName);
    const existing = await this.payments.findByIdempotencyKey(input.customerId, input.idempotencyKey);

    if (existing) {
      this.assertOrderMatches(existing, input);
      if (existing.provider !== provider.provider) {
        throw new Error("Idempotency key is already bound to another payment provider");
      }
      const checkout = existing.checkoutUrl
        ? {
            providerReference: existing.providerReference,
            provider: existing.provider,
            publicKey: "",
            currency: existing.currency,
            amountInCents: existing.amountInCents,
            integritySignature: "",
            checkoutUrl: existing.checkoutUrl,
          }
        : await provider.recoverPaymentIntent(existing, input);
      await this.reservations.extendForOrder(input.orderId, 30);
      await this.recordPaymentIntentLedger(existing);
      return { payment: existing, checkout };
    }

    const order = await this.orders.findById(input.orderId);
    if (!order) throw new Error("Order not found");
    if (order.customerId !== input.customerId) throw new Error("Order does not belong to customer");
    if (order.status !== "PENDING_PAYMENT") throw new Error("Order is not awaiting payment");
    if (order.totalInCents !== input.amountInCents || order.currency !== input.currency) {
      throw new Error("Payment amount or currency does not match order");
    }

    const checkout = await provider.createPaymentIntent(input);
    if (
      checkout.provider !== provider.provider ||
      checkout.amountInCents !== input.amountInCents ||
      checkout.currency !== input.currency
    ) {
      throw new Error("Payment provider returned an inconsistent payment intent");
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: crypto.randomUUID(),
      orderId: input.orderId,
      customerId: input.customerId,
      provider: checkout.provider,
      providerReference: checkout.providerReference,
      ...(checkout.checkoutUrl ? { checkoutUrl: checkout.checkoutUrl } : {}),
      status: "PENDING",
      amountInCents: checkout.amountInCents,
      currency: checkout.currency,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.payments.create(payment);
    } catch (error) {
      const raced = await this.payments.findByIdempotencyKey(input.customerId, input.idempotencyKey);
      if (!raced) throw error;
      this.assertOrderMatches(raced, input);
      if (raced.provider !== provider.provider) {
        throw new Error("Concurrent payment selected a different provider");
      }
      const recovered = raced.checkoutUrl
        ? {
            providerReference: raced.providerReference,
            provider: raced.provider,
            publicKey: "",
            currency: raced.currency,
            amountInCents: raced.amountInCents,
            integritySignature: "",
            checkoutUrl: raced.checkoutUrl,
          }
        : await provider.recoverPaymentIntent(raced, input);
      await this.reservations.extendForOrder(input.orderId, 30);
      await this.recordPaymentIntentLedger(raced);
      return { payment: raced, checkout: recovered };
    }

    await this.reservations.extendForOrder(input.orderId, 30);
    await this.recordPaymentIntentLedger(payment);
    return { payment, checkout };
  }

  async refundPayment(paymentId: string, idempotencyKey: string): Promise<Payment> {
    const key = idempotencyKey.trim();
    if (!key || key.length > 255) throw new Error("A valid Idempotency-Key is required");

    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new Error("Payment not found");

    const existing = await this.payments.findRefund(payment.id, key);
    if (existing) {
      this.assertRefundMatchesPayment(existing, payment);
      if (existing.status === "SUCCEEDED") {
        return this.completeRefund(
          payment,
          existing.amountInCents,
          existing.currency,
          existing.providerRefundId,
          key,
        );
      }
      if (existing.status === "FAILED") {
        throw new Error("The refund attempt has failed; use a new idempotency key");
      }
      return this.reconcileRefund(payment.id, key);
    }

    if (payment.status === "REFUNDED") return payment;
    if (payment.status !== "PAID") throw new Error("Only a PAID payment can be refunded");

    const provider = this.providers.resolve(payment.provider);
    if (!provider.refundPayment) {
      throw new Error(`Refund is not supported by ${payment.provider}`);
    }

    await this.ensureRefundLock(payment.id, key);

    try {
      const providerRefund = await provider.refundPayment(
        payment.providerTransactionId ?? payment.providerReference,
        payment.amountInCents,
        key,
      );
      this.assertProviderRefundMatchesPayment(providerRefund, payment);

      const inserted = await this.payments.recordRefund(
        payment.id,
        key,
        providerRefund.amountInCents,
        providerRefund.currency,
        providerRefund.providerRefundId,
        providerRefund.status,
      );

      let stored: StoredRefund | null = inserted
        ? {
            providerRefundId: providerRefund.providerRefundId,
            amountInCents: providerRefund.amountInCents,
            currency: providerRefund.currency,
            status: providerRefund.status,
          }
        : await this.payments.findRefund(payment.id, key);

      if (!stored) throw new Error("Provider refund could not be persisted");
      this.assertRefundMatchesPayment(stored, payment);

      if (providerRefund.status === "SUCCEEDED" && stored.status !== "SUCCEEDED") {
        await this.payments.updateRefundStatus(payment.id, key, "SUCCEEDED");
        stored = await this.payments.findRefund(payment.id, key);
      }
      if (!stored) throw new Error("Persisted refund could not be reloaded");

      if (stored.status === "SUCCEEDED") {
        return this.completeRefund(
          payment,
          stored.amountInCents,
          stored.currency,
          stored.providerRefundId,
          key,
        );
      }
      if (stored.status === "FAILED") {
        throw new Error("The refund attempt has failed; use a new idempotency key");
      }

      await this.recordPendingRefundLedger(payment, stored);
      return (await this.payments.findById(payment.id)) ?? payment;
    } catch (error) {
      // The provider may have completed the refund even if a later D1 write failed.
      // Keep the lock unless finalization succeeds; a retry with the same key is safe.
      const persisted = await this.payments.findRefund(payment.id, key).catch(() => null);
      if (persisted?.status === "SUCCEEDED") {
        return this.completeRefund(
          payment,
          persisted.amountInCents,
          persisted.currency,
          persisted.providerRefundId,
          key,
        );
      }
      throw error;
    }
  }

  async reconcileRefund(paymentId: string, idempotencyKey: string): Promise<Payment> {
    const key = idempotencyKey.trim();
    if (!key || key.length > 255) throw new Error("A valid Idempotency-Key is required");

    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new Error("Payment not found");

    let refund = await this.payments.findRefund(payment.id, key);
    if (!refund) throw new Error("Refund not found");
    this.assertRefundMatchesPayment(refund, payment);

    if (refund.status === "SUCCEEDED") {
      return this.completeRefund(
        payment,
        refund.amountInCents,
        refund.currency,
        refund.providerRefundId,
        key,
      );
    }
    if (refund.status === "FAILED") {
      throw new Error("The refund attempt has failed; use a new idempotency key");
    }

    await this.ensureRefundLock(payment.id, key);

    const provider = this.providers.resolve(payment.provider);
    if (!provider.getRefund) {
      throw new Error(`Refund reconciliation is not supported by ${payment.provider}`);
    }

    const current = await provider.getRefund(
      payment.providerTransactionId ?? payment.providerReference,
      refund.providerRefundId,
    );
    if (
      current.providerRefundId !== refund.providerRefundId ||
      current.amountInCents !== refund.amountInCents ||
      current.currency !== refund.currency
    ) {
      throw new Error("Provider refund does not match recorded refund");
    }

    await this.payments.updateRefundStatus(payment.id, key, current.status);
    refund = await this.payments.findRefund(payment.id, key);
    if (!refund) throw new Error("Refund disappeared during reconciliation");

    if (refund.status === "SUCCEEDED") {
      return this.completeRefund(
        payment,
        refund.amountInCents,
        refund.currency,
        refund.providerRefundId,
        key,
      );
    }
    if (refund.status === "FAILED") {
      throw new Error("The refund attempt has failed; use a new idempotency key");
    }

    await this.recordPendingRefundLedger(payment, refund);
    return (await this.payments.findById(payment.id)) ?? payment;
  }

  async voidPayment(paymentId: string, idempotencyKey: string): Promise<Payment> {
    if (!idempotencyKey || idempotencyKey.length > 255) {
      throw new Error("A valid Idempotency-Key is required");
    }
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new Error("Payment not found");
    if (!["PENDING", "PROCESSING"].includes(payment.status)) {
      throw new Error("Only pending or processing payments can be voided");
    }
    if (!payment.providerTransactionId) {
      throw new Error("Provider transaction id is required before voiding a payment");
    }

    const provider = this.providers.resolve(payment.provider);
    if (!provider.voidPayment) throw new Error(`Void is not supported by ${payment.provider}`);

    const transaction = await provider.voidPayment(payment.providerTransactionId, idempotencyKey);
    if (
      transaction.provider !== payment.provider ||
      transaction.amountInCents !== payment.amountInCents ||
      transaction.currency !== payment.currency
    ) {
      throw new Error("Provider void transaction does not match payment");
    }

    await this.processProviderTransaction(
      transaction,
      JSON.stringify({ source: "void", idempotencyKey }),
      `void:${payment.id}:${idempotencyKey}`,
    );
    return (await this.payments.findById(payment.id)) ?? payment;
  }

  async processProviderTransaction(
    transaction: ProviderTransaction,
    rawEvent: string,
    eventId?: string,
  ): Promise<void> {
    let payment = await this.payments.findByProviderReference(transaction.reference);
    if (!payment) payment = await this.payments.findByOrderId(transaction.reference);
    if (!payment) payment = await this.payments.findByProviderTransactionId(transaction.transactionId);
    if (!payment) return;

    if (payment.provider !== transaction.provider) throw new Error("Provider mismatch");
    if (
      payment.amountInCents !== transaction.amountInCents ||
      payment.currency !== transaction.currency
    ) {
      await this.payments.recordLedger(
        payment.id,
        "SECURITY_MISMATCH",
        transaction.amountInCents,
        transaction.currency,
        JSON.stringify({ transactionId: transaction.transactionId, provider: transaction.provider }),
      );
      throw new Error("Provider transaction does not match payment intent");
    }

    await this.applyTransaction(payment, transaction);
    await this.payments.recordWebhook(
      payment.provider,
      eventId ?? this.eventId(transaction, rawEvent),
      rawEvent,
    );
  }

  async reconcile(
    providerName: ProviderTransaction["provider"],
    transactionId: string,
  ): Promise<ProviderTransaction> {
    const transaction = await this.providers.resolve(providerName).getTransaction(transactionId);
    await this.processProviderTransaction(
      transaction,
      JSON.stringify({ source: "reconciliation", transaction }),
      `reconciliation:${providerName}:${transactionId}`,
    );
    return transaction;
  }

  private async applyTransaction(
    payment: Payment,
    transaction: ProviderTransaction,
  ): Promise<void> {
    const attached = await this.payments.attachProviderTransaction(
      payment.id,
      transaction.transactionId,
    );
    if (!attached) {
      const current = await this.payments.findById(payment.id);
      if (current?.providerTransactionId !== transaction.transactionId) {
        throw new Error("Provider transaction id does not match the payment");
      }
    }

    const currentPayment = await this.payments.findById(payment.id);
    if (!currentPayment) throw new Error("Payment disappeared while applying provider transaction");

    if (transaction.status === "APPROVED") {
      return this.markPaid({ ...currentPayment, providerTransactionId: transaction.transactionId });
    }
    if (transaction.status === "DECLINED" || transaction.status === "ERROR") {
      return this.markFailed(currentPayment);
    }
    if (transaction.status === "VOIDED") return this.markCancelled(currentPayment);

    if (currentPayment.status === "PENDING") {
      await this.payments.transition(payment.id, "PENDING", "PROCESSING");
    }
  }

  private async markPaid(payment: Payment): Promise<void> {
    const order = await this.orders.findById(payment.orderId);
    if (!order) throw new Error("Order not found while confirming payment");

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      if (payment.status === "PAID") {
        throw new Error("Paid payment is linked to a closed order");
      }
      await this.payments.recordLedger(
        payment.id,
        "LATE_APPROVAL_AFTER_ORDER_CLOSED",
        payment.amountInCents,
        payment.currency,
        JSON.stringify({ transactionId: payment.providerTransactionId }),
      );
      return;
    }

    const current = await this.payments.findById(payment.id);
    if (!current) throw new Error("Payment disappeared while confirming payment");

    if (current.status !== "PAID") {
      if (!["PENDING", "PROCESSING"].includes(current.status)) return;
      assertPaymentTransition(current.status, "PAID");
      const changed = await this.payments.transition(current.id, current.status, "PAID");
      if (!changed) {
        const latest = await this.payments.findById(current.id);
        if (latest?.status !== "PAID") {
          throw new Error("Concurrent payment transition prevented confirmation");
        }
      }
    }

    await this.ensureOrderStatus(payment.orderId, "PAID");
    await this.reservations.consumeForOrder(payment.orderId);
    await this.payments.recordLedger(
      payment.id,
      "PAYMENT_CONFIRMED",
      payment.amountInCents,
      payment.currency,
      "{}",
    );
  }

  private async markFailed(payment: Payment): Promise<void> {
    const current = await this.payments.findById(payment.id);
    if (!current) throw new Error("Payment disappeared while recording failure");
    if (current.status === "CANCELLED" || current.status === "PAID" || current.status === "REFUNDED") {
      return;
    }

    if (current.status !== "FAILED") {
      if (!["PENDING", "PROCESSING"].includes(current.status)) return;
      assertPaymentTransition(current.status, "FAILED");
      const changed = await this.payments.transition(current.id, current.status, "FAILED");
      if (!changed) {
        const latest = await this.payments.findById(current.id);
        if (latest?.status !== "FAILED") return;
      }
    }

    await this.ensureOrderStatus(payment.orderId, "CANCELLED");
    await this.reservations.releaseForOrder(payment.orderId);
    await this.payments.recordLedger(payment.id, "PAYMENT_FAILED", 0, payment.currency, "{}");
  }

  private async markCancelled(payment: Payment): Promise<void> {
    const current = await this.payments.findById(payment.id);
    if (!current) throw new Error("Payment disappeared while recording cancellation");
    if (current.status === "FAILED" || current.status === "PAID" || current.status === "REFUNDED") {
      return;
    }

    if (current.status !== "CANCELLED") {
      if (!["PENDING", "PROCESSING"].includes(current.status)) return;
      assertPaymentTransition(current.status, "CANCELLED");
      const changed = await this.payments.transition(current.id, current.status, "CANCELLED");
      if (!changed) {
        const latest = await this.payments.findById(current.id);
        if (latest?.status !== "CANCELLED") return;
      }
    }

    await this.ensureOrderStatus(payment.orderId, "CANCELLED");
    await this.reservations.releaseForOrder(payment.orderId);
    await this.payments.recordLedger(payment.id, "PAYMENT_CANCELLED", 0, payment.currency, "{}");
  }

  private async ensureOrderStatus(orderId: string, target: "PAID" | "CANCELLED"): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new Error("Order not found while finalizing payment");
    if (order.status === target) return;

    // Provider approval replays can arrive after fulfillment has advanced the order.
    // Those downstream states already imply that payment was accepted; never move them back.
    if (
      target === "PAID" &&
      ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"].includes(order.status)
    ) {
      return;
    }

    if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_PROCESSING") {
      throw new Error(`Cannot finalize order from status ${order.status} to ${target}`);
    }

    const changed = await this.orders.transitionStatus(orderId, order.status, target);
    if (changed) return;

    const current = await this.orders.findById(orderId);
    if (current?.status !== target) {
      throw new Error(`Order transition to ${target} failed`);
    }
  }

  private async completeRefund(
    payment: Payment,
    amountInCents: number,
    currency: string,
    providerRefundId: string,
    idempotencyKey: string,
  ): Promise<Payment> {
    if (amountInCents !== payment.amountInCents || currency !== payment.currency) {
      throw new Error("Provider refund does not match payment amount or currency");
    }
    if (!providerRefundId) throw new Error("Provider refund id is required");

    let current = await this.payments.findById(payment.id);
    if (!current) throw new Error("Payment not found while finalizing refund");

    if (current.status === "PAID") {
      assertPaymentTransition("PAID", "REFUNDED");
      const changed = await this.payments.transition(current.id, "PAID", "REFUNDED");
      if (!changed) {
        current = await this.payments.findById(payment.id);
        if (current?.status !== "REFUNDED") {
          throw new Error("Refund completed but payment transition failed");
        }
      } else {
        current = { ...current, status: "REFUNDED" };
      }
    }

    if (current.status !== "REFUNDED") {
      throw new Error(`Cannot finalize refund while payment is ${current.status}`);
    }

    // Keep the order lifecycle aligned with the provider-confirmed refund.
    // The payment transition is persisted first so a retry can finish the order transition.
    await this.ensureRefundedOrderStatus(payment.orderId);

    await this.payments.recordLedger(
      payment.id,
      "PAYMENT_REFUNDED",
      amountInCents,
      currency,
      JSON.stringify({ providerRefundId, idempotencyKey }),
    );
    await this.payments.releaseRefundLock(payment.id, idempotencyKey);
    return current;
  }

  private async ensureRefundedOrderStatus(orderId: string): Promise<void> {
    let order = await this.orders.findById(orderId);
    if (!order) throw new Error("Order not found while finalizing refund");

    if (order.status === "PAID" || order.status === "DELIVERED") {
      const previousStatus = order.status;
      const movedToPending = await this.orders.transitionStatus(
        orderId,
        previousStatus,
        "REFUND_PENDING",
      );
      if (!movedToPending) {
        order = await this.orders.findById(orderId);
        if (order?.status !== "REFUND_PENDING" && order?.status !== "REFUNDED") {
          throw new Error(`Order transition from ${previousStatus} to REFUND_PENDING failed`);
        }
      } else {
        order = { ...order, status: "REFUND_PENDING" };
      }
    }

    if (order?.status === "REFUND_PENDING") {
      const movedToRefunded = await this.orders.transitionStatus(orderId, "REFUND_PENDING", "REFUNDED");
      if (!movedToRefunded) {
        order = await this.orders.findById(orderId);
        if (order?.status !== "REFUNDED") {
          throw new Error("Order transition to REFUNDED failed");
        }
      } else {
        order = { ...order, status: "REFUNDED" };
      }
    }

    if (order?.status !== "REFUNDED") {
      throw new Error(`Cannot finalize refund while order is ${order?.status ?? "missing"}`);
    }
  }

  private async recordPendingRefundLedger(payment: Payment, refund: StoredRefund): Promise<void> {
    await this.payments.recordLedger(
      payment.id,
      "PAYMENT_REFUND_PENDING",
      refund.amountInCents,
      refund.currency,
      JSON.stringify({ providerRefundId: refund.providerRefundId }),
    );
  }

  private async ensureRefundLock(paymentId: string, idempotencyKey: string): Promise<void> {
    const acquired = await this.payments.acquireRefundLock(paymentId, idempotencyKey);
    if (acquired) return;

    const owner = await this.payments.findRefundLock(paymentId);
    if (owner !== idempotencyKey) {
      throw new Error("Another refund operation is already in progress for this payment");
    }
  }

  private assertRefundMatchesPayment(refund: StoredRefund, payment: Payment): void {
    if (
      refund.amountInCents !== payment.amountInCents ||
      refund.currency !== payment.currency
    ) {
      throw new Error("Recorded refund does not match payment amount or currency");
    }
  }

  private assertProviderRefundMatchesPayment(
    refund: Awaited<ReturnType<NonNullable<PaymentProviderPort["refundPayment"]>>>,
    payment: Payment,
  ): void {
    if (
      !refund.providerRefundId ||
      refund.amountInCents !== payment.amountInCents ||
      refund.currency !== payment.currency
    ) {
      throw new Error("Provider refund does not match payment amount or currency");
    }
  }

  private async recordPaymentIntentLedger(payment: Payment): Promise<void> {
    await this.payments.recordLedger(
      payment.id,
      "PAYMENT_INTENT_CREATED",
      payment.amountInCents,
      payment.currency,
      JSON.stringify({ provider: payment.provider, reference: payment.providerReference }),
    );
  }

  private assertOrderMatches(payment: Payment, input: CreatePaymentInput): void {
    if (
      payment.orderId !== input.orderId ||
      payment.amountInCents !== input.amountInCents ||
      payment.currency !== input.currency
    ) {
      throw new Error("Idempotency key is bound to a different payment");
    }
  }

  private eventId(transaction: ProviderTransaction, rawEvent: string): string {
    return `${transaction.provider}:${transaction.transactionId}:${transaction.status}:${this.simpleHash(rawEvent)}`;
  }

  private simpleHash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}
