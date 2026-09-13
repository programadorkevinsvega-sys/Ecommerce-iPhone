import type { Payment } from "../domain/Payment";
import type { PaymentService } from "./PaymentService";

export interface AuditPort {
  audit(adminUserId: string, action: string, resourceType: string, resourceId: string | null, payload: unknown): Promise<void>;
}

export interface AdminPaymentRefund {
  execute(paymentId: string, idempotencyKey: string, adminUserId: string): Promise<Payment>;
}

export class AdminPaymentRefundService implements AdminPaymentRefund {
  constructor(
    private readonly payments: Pick<PaymentService, "refundPayment">,
    private readonly audit: AuditPort,
  ) {}

  async execute(paymentId: string, idempotencyKey: string, adminUserId: string): Promise<Payment> {
    const key = idempotencyKey.trim();
    if (!key || key.length > 255) throw new Error("INVALID_IDEMPOTENCY_KEY");
    const id = paymentId.trim();
    if (!id) throw new Error("PAYMENT_ID_REQUIRED");
    const adminId = adminUserId.trim();
    if (!adminId) throw new Error("ADMIN_ID_REQUIRED");

    const result = await this.payments.refundPayment(id, key);
    await this.audit.audit(adminId, "ADMIN_PAYMENT_REFUND", "payment", id, {
      status: result.status,
      idempotencyKey: key,
    });
    return result;
  }
}
