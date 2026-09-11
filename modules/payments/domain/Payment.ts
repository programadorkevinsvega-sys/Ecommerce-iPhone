export type PaymentStatus = "CREATED" | "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

export type PaymentProvider = "WOMPI" | "STRIPE" | "MERCADOPAGO" | "PAYPAL" | "BINANCE_PAY";

export type Payment = Readonly<{
  id: string;
  orderId: string;
  customerId: string;
  provider: PaymentProvider;
  providerReference: string;
  providerTransactionId?: string;
  checkoutUrl?: string;
  status: PaymentStatus;
  amountInCents: number;
  currency: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}>;

const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ["PENDING", "CANCELLED"],
  PENDING: ["PROCESSING", "PAID", "FAILED", "CANCELLED"],
  PROCESSING: ["PAID", "FAILED", "CANCELLED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return transitions[from].includes(to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) throw new Error(`Invalid payment transition: ${from} -> ${to}`);
}
