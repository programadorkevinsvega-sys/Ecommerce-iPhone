import type { PaymentProvider, PaymentStatus } from "../domain/Payment";

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["CREATED", "PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];
const PAYMENT_PROVIDERS: readonly PaymentProvider[] = ["WOMPI", "STRIPE", "MERCADOPAGO", "PAYPAL", "BINANCE_PAY"];

export type AdminPaymentFilter = Readonly<{ status?: PaymentStatus; provider?: PaymentProvider; limit: number; offset: number }>;
export type AdminPaymentSummary = Readonly<{
  id: string; orderId: string; customerId: string; provider: PaymentProvider; providerReference: string;
  providerTransactionId?: string; status: PaymentStatus; amountInCents: number; currency: string; createdAt: string; updatedAt: string;
}>;
export type AdminPaymentDetails = Readonly<{
  payment: Readonly<{
    id: string; orderId: string; customerId: string; provider: PaymentProvider; providerReference: string;
    providerTransactionId?: string; checkoutUrl?: string; status: PaymentStatus; amountInCents: number; currency: string; createdAt: string; updatedAt: string;
  }>;
  refunds: readonly unknown[]; ledger: readonly unknown[];
}>;
export type AdminPaymentListResult = Readonly<{ items: readonly AdminPaymentSummary[]; limit: number; offset: number }>;

export interface PaymentAdminRepository {
  list(filter: AdminPaymentFilter): Promise<AdminPaymentListResult>;
  findByIdForAdmin(id: string): Promise<AdminPaymentDetails["payment"] | null>;
}

export interface PaymentRefundRepository {
  listByPaymentId(paymentId: string): Promise<readonly unknown[]>;
}

export interface PaymentLedgerRepository {
  listByPaymentId(paymentId: string): Promise<readonly unknown[]>;
}

export interface AdminPaymentQuery {
  list(filter: Partial<AdminPaymentFilter>): Promise<AdminPaymentListResult>;
  get(id: string): Promise<AdminPaymentDetails>;
}

export class AdminPaymentQueryService implements AdminPaymentQuery {
  constructor(
    private readonly payments: PaymentAdminRepository,
    private readonly refunds: PaymentRefundRepository,
    private readonly ledger: PaymentLedgerRepository,
  ) {}

  async list(filter: Partial<AdminPaymentFilter>): Promise<AdminPaymentListResult> {
    const limit = Number(filter.limit ?? 50);
    const offset = Number(filter.offset ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("INVALID_PAYMENT_LIMIT");
    if (!Number.isInteger(offset) || offset < 0) throw new Error("INVALID_PAYMENT_OFFSET");
    const status = filter.status === undefined ? undefined : String(filter.status).trim().toUpperCase();
    const provider = filter.provider === undefined ? undefined : String(filter.provider).trim().toUpperCase();
    if (status !== undefined && !PAYMENT_STATUSES.includes(status as PaymentStatus)) throw new Error("INVALID_PAYMENT_STATUS");
    if (provider !== undefined && !PAYMENT_PROVIDERS.includes(provider as PaymentProvider)) throw new Error("INVALID_PAYMENT_PROVIDER");
    return this.payments.list({
      ...(status === undefined ? {} : { status: status as PaymentStatus }),
      ...(provider === undefined ? {} : { provider: provider as PaymentProvider }),
      limit,
      offset,
    });
  }

  async get(id: string): Promise<AdminPaymentDetails> {
    const normalized = id.trim();
    if (!normalized) throw new Error("PAYMENT_ID_REQUIRED");
    const payment = await this.payments.findByIdForAdmin(normalized);
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    const [refunds, ledger] = await Promise.all([
      this.refunds.listByPaymentId(normalized),
      this.ledger.listByPaymentId(normalized),
    ]);
    return { payment, refunds, ledger };
  }
}
