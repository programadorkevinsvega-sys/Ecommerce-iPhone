import type { Payment } from "../domain/Payment";
import type { PaymentService } from "./PaymentService";
import type { AuditPort } from "./AdminPaymentRefund";

export interface AdminPaymentVoid {
  execute(paymentId: string, idempotencyKey: string, adminUserId: string): Promise<Payment>;
}

export class AdminPaymentVoidService implements AdminPaymentVoid {
  constructor(
    private readonly payments: Pick<PaymentService, "voidPayment">,
    private readonly audit: AuditPort,
  ) {}

  async execute(paymentId: string, idempotencyKey: string, adminUserId: string): Promise<Payment> {
    const key = idempotencyKey.trim();
    if (!key || key.length > 255) throw new Error("INVALID_IDEMPOTENCY_KEY");
    const id = paymentId.trim();
    if (!id) throw new Error("PAYMENT_ID_REQUIRED");
    const adminId = adminUserId.trim();
    if (!adminId) throw new Error("ADMIN_ID_REQUIRED");

    const result = await this.payments.voidPayment(id, key);
    await this.audit.audit(adminId, "ADMIN_PAYMENT_VOID", "payment", id, {
      status: result.status,
      idempotencyKey: key,
    });
    return result;
  }
}
