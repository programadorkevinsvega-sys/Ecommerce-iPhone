import type { Payment } from "../domain/Payment";
import type { PaymentProvider, PaymentStatus } from "../domain/Payment";
import { AdminPaymentQueryService, type PaymentAdminRepository, type PaymentLedgerRepository, type PaymentRefundRepository } from "./AdminPaymentQuery";
import { AdminPaymentRefundService, type AuditPort } from "./AdminPaymentRefund";
import { AdminPaymentVoidService } from "./AdminPaymentVoid";
import type { PaymentService } from "./PaymentService";

export type AdminPaymentRequest = Readonly<{ status?: PaymentStatus; provider?: PaymentProvider; limit?: number; offset?: number }>;

export class AdminPayments {
  private readonly query: AdminPaymentQueryService;
  private readonly refundUseCase: AdminPaymentRefundService;
  private readonly voidPaymentUseCase: AdminPaymentVoidService;

  constructor(
    paymentRepository: PaymentAdminRepository,
    refundRepository: PaymentRefundRepository,
    ledgerRepository: PaymentLedgerRepository,
    paymentService: Pick<PaymentService, "refundPayment" | "voidPayment">,
    audit: AuditPort,
  ) {
    this.query = new AdminPaymentQueryService(paymentRepository, refundRepository, ledgerRepository);
    this.refundUseCase = new AdminPaymentRefundService(paymentService, audit);
    this.voidPaymentUseCase = new AdminPaymentVoidService(paymentService, audit);
  }

  list(request: AdminPaymentRequest = {}) { return this.query.list(request); }
  get(id: string) { return this.query.get(id); }
  refund(id: string, idempotencyKey: string, adminUserId: string): Promise<Payment> { return this.refundUseCase.execute(id, idempotencyKey, adminUserId); }
  void(id: string, idempotencyKey: string, adminUserId: string): Promise<Payment> { return this.voidPaymentUseCase.execute(id, idempotencyKey, adminUserId); }
}
