import { describe, expect, it } from "vitest";
import type { Payment, PaymentProvider } from "../domain/Payment";
import { PaymentProviderRegistry } from "./PaymentProviderRegistry";
import type {
  OrderPaymentPort,
  PaymentProviderPort,
  PaymentRepository,
  ProviderTransaction,
  ReservationPaymentPort,
} from "./PaymentPorts";
import { PaymentService } from "./PaymentService";

type RefundRecord = {
  providerRefundId: string;
  amountInCents: number;
  currency: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
};

const basePayment = (status: Payment["status"] = "PENDING"): Payment => ({
  id: "p1",
  orderId: "o1",
  customerId: "c1",
  provider: "STRIPE",
  providerReference: "ref-1",
  status,
  amountInCents: 10000,
  currency: "COP",
  idempotencyKey: "idem-1",
  createdAt: "2026-09-11T00:00:00Z",
  updatedAt: "2026-09-11T00:00:00Z",
});

const approved = (amountInCents = 10000): ProviderTransaction => ({
  provider: "STRIPE",
  transactionId: "tx-1",
  reference: "ref-1",
  status: "APPROVED",
  amountInCents,
  currency: "COP",
});

class MemoryPayments implements PaymentRepository {
  payment = basePayment();
  refunds = new Map<string, RefundRecord>();
  lockOwner: string | null = null;
  refundCalls = 0;
  transitions = 0;
  ledger = new Map<string, { amountInCents: number; currency: string; metadata: string }>();
  failNextLedger = new Set<string>();

  async findById(id: string) {
    return id === this.payment.id ? this.payment : null;
  }

  async findByOrderId(id: string) {
    return id === this.payment.orderId ? this.payment : null;
  }

  async findByIdempotencyKey() {
    return null;
  }

  async findByProviderReference(reference: string) {
    return reference === this.payment.providerReference ? this.payment : null;
  }

  async findByProviderTransactionId(id: string) {
    return id === this.payment.providerTransactionId ? this.payment : null;
  }

  async create(payment: Payment) {
    this.payment = payment;
  }

  async attachProviderTransaction(id: string, transactionId: string) {
    if (id !== this.payment.id) return false;
    if (this.payment.providerTransactionId && this.payment.providerTransactionId !== transactionId) {
      return false;
    }
    this.payment = { ...this.payment, providerTransactionId: transactionId };
    return true;
  }

  async transition(id: string, from: Payment["status"], to: Payment["status"]) {
    if (id !== this.payment.id || this.payment.status !== from) return false;
    this.payment = { ...this.payment, status: to };
    this.transitions += 1;
    return true;
  }

  async recordWebhook() {
    return true;
  }

  async recordLedger(
    _paymentId: string,
    entryType: string,
    amountInCents: number,
    currency: string,
    metadata: string,
  ) {
    if (this.failNextLedger.delete(entryType)) throw new Error("ledger unavailable");
    this.ledger.set(`${entryType}:${amountInCents}`, { amountInCents, currency, metadata });
  }

  async acquireRefundLock(_paymentId: string, key: string) {
    if (this.lockOwner) return false;
    this.lockOwner = key;
    return true;
  }

  async findRefundLock() {
    return this.lockOwner;
  }

  async releaseRefundLock(_paymentId: string, key: string) {
    if (this.lockOwner === key) this.lockOwner = null;
  }

  async recordRefund(
    paymentId: string,
    key: string,
    amountInCents: number,
    currency: string,
    providerRefundId: string,
    status: "SUCCEEDED" | "PENDING" | "FAILED",
  ) {
    const mapKey = `${paymentId}:${key}`;
    if (this.refunds.has(mapKey)) return false;
    this.refunds.set(mapKey, { providerRefundId, amountInCents, currency, status });
    return true;
  }

  async updateRefundStatus(
    paymentId: string,
    key: string,
    status: "SUCCEEDED" | "PENDING" | "FAILED",
  ) {
    const refund = this.refunds.get(`${paymentId}:${key}`);
    if (!refund) return false;
    if (refund.status !== "PENDING" && refund.status !== status) return false;
    refund.status = status;
    return true;
  }

  async findRefund(paymentId: string, key: string) {
    return this.refunds.get(`${paymentId}:${key}`) ?? null;
  }
}

class MemoryOrders implements OrderPaymentPort {
  status = "PENDING_PAYMENT";
  readonly failedTransitions = new Map<string, number>();

  async findById(id: string) {
    return id === "o1"
      ? { id, customerId: "c1", status: this.status, totalInCents: 10000, currency: "COP" }
      : null;
  }

  async transitionStatus(_id: string, from: string, to: string) {
    if (this.status !== from) return false;
    const failures = this.failedTransitions.get(to) ?? 0;
    if (failures > 0) {
      this.failedTransitions.set(to, failures - 1);
      return false;
    }
    this.status = to;
    return true;
  }
}

class MemoryReservations implements ReservationPaymentPort {
  consumed = 0;
  released = 0;

  async releaseForOrder() {
    this.released += 1;
    return 1;
  }

  async consumeForOrder() {
    this.consumed += 1;
    return 1;
  }

  async extendForOrder() {
    return 1;
  }
}

function service(
  payments: MemoryPayments,
  pendingRefund = false,
  orders = new MemoryOrders(),
  reservations = new MemoryReservations(),
) {
  const provider: PaymentProviderPort = {
    provider: "STRIPE" as PaymentProvider,
    createPaymentIntent: async () => ({
      providerReference: "ref-1",
      provider: "STRIPE",
      publicKey: "",
      currency: "COP",
      amountInCents: 10000,
      integritySignature: "",
      checkoutUrl: "https://checkout",
    }),
    recoverPaymentIntent: async () => ({
      providerReference: "ref-1",
      provider: "STRIPE",
      publicKey: "",
      currency: "COP",
      amountInCents: 10000,
      integritySignature: "",
      checkoutUrl: "https://checkout",
    }),
    getTransaction: async () => approved(),
    refundPayment: async (_id, amountInCents, key) => {
      payments.refundCalls += 1;
      return {
        providerRefundId: `re-${key}`,
        status: pendingRefund ? "PENDING" : "SUCCEEDED",
        amountInCents,
        currency: "COP",
      };
    },
    getRefund: async (_id, refundId) => ({
      providerRefundId: refundId,
      status: "SUCCEEDED",
      amountInCents: 10000,
      currency: "COP",
    }),
  };

  return {
    service: new PaymentService(
      payments,
      new PaymentProviderRegistry([provider]),
      orders,
      reservations,
    ),
    orders,
    reservations,
  };
}

describe("PaymentService critical invariants", () => {
  it("applies duplicate approvals without duplicate payment transitions", async () => {
    const payments = new MemoryPayments();
    const { service: sut, reservations, orders } = service(payments);

    await Promise.all([
      sut.processProviderTransaction(approved(), "event-1"),
      sut.processProviderTransaction(approved(), "event-1"),
    ]);

    expect(payments.payment.status).toBe("PAID");
    expect(orders.status).toBe("PAID");
    expect(reservations.consumed).toBeGreaterThanOrEqual(1);
    expect(payments.transitions).toBe(1);
    expect(payments.ledger.has("PAYMENT_CONFIRMED:10000")).toBe(true);
  });

  it("keeps an approval replay idempotent after fulfillment advances the order", async () => {
    const payments = new MemoryPayments();
    payments.payment = {
      ...payments.payment,
      status: "PAID",
      providerTransactionId: "tx-1",
    };
    const { service: sut, orders, reservations } = service(payments);
    orders.status = "PROCESSING";

    await sut.processProviderTransaction(approved(), "approval-after-fulfillment");

    expect(payments.payment.status).toBe("PAID");
    expect(orders.status).toBe("PROCESSING");
    expect(reservations.consumed).toBeGreaterThan(0);
    expect(payments.ledger.has("PAYMENT_CONFIRMED:10000")).toBe(true);
  });

  it("does not allow a later declined event to move a paid payment backwards", async () => {
    const payments = new MemoryPayments();
    const { service: sut } = service(payments);

    await sut.processProviderTransaction(approved(), "approved");
    await sut.processProviderTransaction({ ...approved(), status: "DECLINED" }, "declined");

    expect(payments.payment.status).toBe("PAID");
  });

  it("rejects provider amount tampering", async () => {
    const payments = new MemoryPayments();
    const { service: sut } = service(payments);

    await expect(
      sut.processProviderTransaction(approved(9999), "tampered"),
    ).rejects.toThrow("does not match payment intent");
    expect(payments.payment.status).toBe("PENDING");
  });

  it("repairs order, reservation, and ledger effects when an approval is replayed", async () => {
    const payments = new MemoryPayments();
    payments.payment = { ...payments.payment, status: "PAID", providerTransactionId: "tx-1" };
    const { service: sut, orders, reservations } = service(payments);

    await sut.processProviderTransaction(approved(), "approval-replay");

    expect(orders.status).toBe("PAID");
    expect(reservations.consumed).toBeGreaterThan(0);
    expect(payments.ledger.has("PAYMENT_CONFIRMED:10000")).toBe(true);
  });

  it("repairs a missing confirmation ledger entry after a partial failure", async () => {
    const payments = new MemoryPayments();
    payments.failNextLedger.add("PAYMENT_CONFIRMED");
    const { service: sut, orders, reservations } = service(payments);

    await expect(
      sut.processProviderTransaction(approved(), "approval-ledger-failure"),
    ).rejects.toThrow("ledger unavailable");

    expect(payments.payment.status).toBe("PAID");
    expect(orders.status).toBe("PAID");
    expect(payments.ledger.has("PAYMENT_CONFIRMED:10000")).toBe(false);

    await sut.processProviderTransaction(approved(), "approval-ledger-retry");

    expect(payments.ledger.has("PAYMENT_CONFIRMED:10000")).toBe(true);
    expect(reservations.consumed).toBeGreaterThanOrEqual(2);
  });

  it("repairs order and reservation cleanup when a failed payment is replayed", async () => {
    const payments = new MemoryPayments();
    payments.payment = { ...payments.payment, status: "FAILED" };
    const { service: sut, orders, reservations } = service(payments);

    await sut.processProviderTransaction({ ...approved(), status: "DECLINED" }, "declined-replay");

    expect(orders.status).toBe("CANCELLED");
    expect(reservations.released).toBeGreaterThan(0);
    expect(payments.ledger.has("PAYMENT_FAILED:0")).toBe(true);
  });

  it("rejects a provider transaction that conflicts with the one already attached", async () => {
    const payments = new MemoryPayments();
    payments.payment = { ...payments.payment, providerTransactionId: "different-tx" };
    const { service: sut } = service(payments);

    await expect(
      sut.processProviderTransaction(approved(), "wrong-transaction"),
    ).rejects.toThrow("does not match the payment");
    expect(payments.payment.status).toBe("PENDING");
  });

  it("supports an idempotent full refund and records the ledger once", async () => {
    const payments = new MemoryPayments();
    payments.payment = {
      ...payments.payment,
      status: "PAID",
      providerTransactionId: "tx-1",
    };
    const { service: sut, orders } = service(payments);
    orders.status = "PAID";

    const first = await sut.refundPayment("p1", "refund-1");
    const second = await sut.refundPayment("p1", "refund-1");

    expect(first.status).toBe("REFUNDED");
    expect(second.status).toBe("REFUNDED");
    expect(orders.status).toBe("REFUNDED");
    expect(payments.refunds.size).toBe(1);
    expect(payments.refundCalls).toBe(1);
    expect(payments.ledger.has("PAYMENT_REFUNDED:10000")).toBe(true);
    expect(payments.lockOwner).toBeNull();
  });

  it("refunds a delivered order through the domain-approved transition", async () => {
    const payments = new MemoryPayments();
    payments.payment = {
      ...payments.payment,
      status: "PAID",
      providerTransactionId: "tx-1",
    };
    const { service: sut, orders } = service(payments);
    orders.status = "DELIVERED";

    const refunded = await sut.refundPayment("p1", "refund-delivered-order");

    expect(refunded.status).toBe("REFUNDED");
    expect(payments.payment.status).toBe("REFUNDED");
    expect(orders.status).toBe("REFUNDED");
    expect(payments.ledger.has("PAYMENT_REFUNDED:10000")).toBe(true);
    expect(payments.lockOwner).toBeNull();
    expect(payments.refundCalls).toBe(1);
  });

  it("blocks concurrent refunds with different idempotency keys", async () => {
    const payments = new MemoryPayments();
    payments.payment = {
      ...payments.payment,
      status: "PAID",
      providerTransactionId: "tx-1",
    };
    const { service: sut, orders } = service(payments);
    orders.status = "PAID";

    const results = await Promise.allSettled([
      sut.refundPayment("p1", "refund-a"),
      sut.refundPayment("p1", "refund-b"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(payments.refundCalls).toBe(1);
  });

  it("keeps a pending refund locked until reconciliation succeeds", async () => {
    const payments = new MemoryPayments();
    payments.payment = {
      ...payments.payment,
      status: "PAID",
      providerTransactionId: "tx-1",
    };
    const { service: sut, orders } = service(payments, true);
    orders.status = "PAID";

    const pending = await sut.refundPayment("p1", "refund-pending");
    expect(pending.status).toBe("PAID");
    expect(payments.lockOwner).toBe("refund-pending");
    expect(payments.ledger.has("PAYMENT_REFUND_PENDING:10000")).toBe(true);

    const reconciled = await sut.reconcileRefund("p1", "refund-pending");

    expect(reconciled.status).toBe("REFUNDED");
    expect(orders.status).toBe("REFUNDED");
    expect(payments.refunds.get("p1:refund-pending")?.status).toBe("SUCCEEDED");
    expect(payments.lockOwner).toBeNull();
    expect(payments.ledger.has("PAYMENT_REFUNDED:10000")).toBe(true);
  });

  it("recovers a provider-approved refund when the first ledger write fails", async () => {
    const payments = new MemoryPayments();
    payments.payment = {
      ...payments.payment,
      status: "PAID",
      providerTransactionId: "tx-1",
    };
    payments.failNextLedger.add("PAYMENT_REFUNDED");
    const { service: sut, orders } = service(payments);
    orders.status = "PAID";

    const result = await sut.refundPayment("p1", "refund-ledger-retry");

    expect(result.status).toBe("REFUNDED");
    expect(payments.payment.status).toBe("REFUNDED");
    expect(orders.status).toBe("REFUNDED");
    expect(payments.ledger.has("PAYMENT_REFUNDED:10000")).toBe(true);
    expect(payments.lockOwner).toBeNull();
    expect(payments.refundCalls).toBe(1);
  });

  it("repairs the order refund transition when a partial finalization fails", async () => {
    const payments = new MemoryPayments();
    payments.payment = {
      ...payments.payment,
      status: "PAID",
      providerTransactionId: "tx-1",
    };
    const { service: sut, orders } = service(payments);
    orders.status = "PAID";
    orders.failedTransitions.set("REFUNDED", 2);

    await expect(sut.refundPayment("p1", "refund-order-retry")).rejects.toThrow(
      "Order transition to REFUNDED failed",
    );
    expect(payments.payment.status).toBe("REFUNDED");
    expect(orders.status).toBe("REFUND_PENDING");
    expect(payments.lockOwner).toBe("refund-order-retry");

    const retried = await sut.refundPayment("p1", "refund-order-retry");

    expect(retried.status).toBe("REFUNDED");
    expect(orders.status).toBe("REFUNDED");
    expect(payments.ledger.has("PAYMENT_REFUNDED:10000")).toBe(true);
    expect(payments.lockOwner).toBeNull();
    expect(payments.refundCalls).toBe(1);
  });

  it("does not let a stale refund operation release a lock owned by another key", async () => {
    const payments = new MemoryPayments();
    payments.lockOwner = "new-owner";

    await payments.releaseRefundLock("p1", "stale-owner");

    expect(payments.lockOwner).toBe("new-owner");
  });
});
