import type { PaymentProvider, PaymentStatus } from "../domain/Payment";

export type AdminPaymentFilter = Readonly<{
  status?: PaymentStatus | undefined;
  provider?: PaymentProvider | undefined;
  limit: number;
  offset: number;
}>;

export type AdminPaymentSummary = Readonly<{
  id: string;
  orderId: string;
  customerId: string;
  provider: PaymentProvider;
  providerReference: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  amountInCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminPaymentDetails = Readonly<{
  payment: Readonly<{
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
    createdAt: string;
    updatedAt: string;
  }>;
  refunds: readonly unknown[];
  ledger: readonly unknown[];
}>;

export type AdminPaymentListResult = Readonly<{
  items: readonly AdminPaymentSummary[];
  limit: number;
  offset: number;
}>;

export interface PaymentAdminRepository {
  list(filter: AdminPaymentFilter): Promise<AdminPaymentListResult>;
  findDetails(id: string): Promise<AdminPaymentDetails | null>;
}

export interface AdminPaymentQuery {
  list(filter: Partial<AdminPaymentFilter>): Promise<AdminPaymentListResult>;
  get(id: string): Promise<AdminPaymentDetails>;
}

export class AdminPaymentQueryService implements AdminPaymentQuery {
  constructor(private readonly repository: PaymentAdminRepository) {}

  async list(filter: Partial<AdminPaymentFilter>): Promise<AdminPaymentListResult> {
    const limit = Math.min(Math.max(Number(filter.limit ?? 50), 1), 100);
    const offset = Math.max(Number(filter.offset ?? 0), 0);
    return this.repository.list({
      ...(filter.status === undefined ? {} : { status: filter.status }),
      ...(filter.provider === undefined ? {} : { provider: filter.provider }),
      limit,
      offset,
    });
  }

  async get(id: string): Promise<AdminPaymentDetails> {
    const normalized = id.trim();
    if (!normalized) throw new Error("PAYMENT_ID_REQUIRED");
    const payment = await this.repository.findDetails(normalized);
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    return payment;
  }
}
