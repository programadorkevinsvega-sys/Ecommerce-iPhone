import type { Payment, PaymentProvider, PaymentStatus } from "../domain/Payment";

export type CreatePaymentInput = Readonly<{
  orderId: string;
  customerId: string;
  amountInCents: number;
  currency: string;
  idempotencyKey: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: Readonly<{
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    countryCode: string;
    phone: string;
  }>;
}>;

export type ProviderPaymentIntent = Readonly<{
  providerReference: string;
  provider: PaymentProvider;
  publicKey: string;
  currency: string;
  amountInCents: number;
  integritySignature: string;
  checkoutUrl: string;
  clientSecret?: string;
}>;

export type ProviderTransaction = Readonly<{
  provider: PaymentProvider;
  transactionId: string;
  reference: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
  amountInCents: number;
  currency: string;
}>;

export type ProviderRefund = Readonly<{
  providerRefundId: string;
  status: "SUCCEEDED" | "PENDING";
  amountInCents: number;
  currency: string;
}>;

export interface PaymentProviderPort {
  readonly provider: PaymentProvider;
  createPaymentIntent(input: CreatePaymentInput): Promise<ProviderPaymentIntent>;
  recoverPaymentIntent(payment: Payment, input: CreatePaymentInput): Promise<ProviderPaymentIntent>;
  getTransaction(transactionId: string): Promise<ProviderTransaction>;
  capturePayment?(transactionId: string): Promise<ProviderTransaction>;
  refundPayment?(
    transactionId: string,
    amountInCents: number,
    idempotencyKey: string,
  ): Promise<ProviderRefund>;
  getRefund?(transactionId: string, providerRefundId: string): Promise<ProviderRefund>;
  voidPayment?(transactionId: string, idempotencyKey: string): Promise<ProviderTransaction>;
}

export interface PaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findByIdempotencyKey(customerId: string, key: string): Promise<Payment | null>;
  findByProviderReference(reference: string): Promise<Payment | null>;
  findByProviderTransactionId(transactionId: string): Promise<Payment | null>;
  create(payment: Payment): Promise<void>;
  attachProviderTransaction(id: string, transactionId: string): Promise<boolean>;
  transition(id: string, from: PaymentStatus, to: PaymentStatus): Promise<boolean>;
  recordWebhook(provider: PaymentProvider, eventId: string, payload: string): Promise<boolean>;
  recordLedger(
    paymentId: string,
    entryType: string,
    amountInCents: number,
    currency: string,
    metadata: string,
  ): Promise<void>;
  acquireRefundLock(paymentId: string, idempotencyKey: string): Promise<boolean>;
  findRefundLock(paymentId: string): Promise<string | null>;
  releaseRefundLock(paymentId: string, idempotencyKey: string): Promise<void>;
  recordRefund(
    paymentId: string,
    idempotencyKey: string,
    amountInCents: number,
    currency: string,
    providerRefundId: string,
    status: "SUCCEEDED" | "PENDING" | "FAILED",
  ): Promise<boolean>;
  updateRefundStatus(
    paymentId: string,
    idempotencyKey: string,
    status: "SUCCEEDED" | "PENDING" | "FAILED",
  ): Promise<boolean>;
  findRefund(
    paymentId: string,
    idempotencyKey: string,
  ): Promise<Readonly<{
    providerRefundId: string;
    amountInCents: number;
    currency: string;
    status: "SUCCEEDED" | "PENDING" | "FAILED";
  }> | null>;
}

export interface OrderPaymentPort {
  findById(id: string): Promise<Readonly<{
    id: string;
    customerId?: string | undefined;
    status: string;
    totalInCents: number;
    currency: string;
  }> | null>;
  transitionStatus(id: string, from: string, to: string): Promise<boolean>;
}

export interface ReservationPaymentPort {
  releaseForOrder(orderId: string): Promise<number>;
  consumeForOrder(orderId: string): Promise<number>;
  extendForOrder(orderId: string, minutes: number): Promise<number>;
}
