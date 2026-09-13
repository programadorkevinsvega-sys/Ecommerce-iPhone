import { AdminDashboardService } from "../../../modules/admin/application/AdminDashboardService";
import { AdminNotificationsService } from "../../../modules/admin/application/AdminNotificationsService";
import { D1AdminDashboardQuery } from "../../../modules/admin/infrastructure/D1AdminDashboardQuery";
import { D1AdminNotificationsQuery } from "../../../modules/admin/infrastructure/D1AdminNotificationsQuery";
import { AdminPayments } from "../../../modules/payments/application/AdminPayments";
import { D1PaymentAdminRepository } from "../../../modules/payments/infrastructure/D1PaymentAdminRepository";
import { D1PaymentAuditPort } from "../../../modules/payments/infrastructure/D1PaymentAuditPort";
import { D1PaymentLedgerRepository } from "../../../modules/payments/infrastructure/D1PaymentLedgerRepository";
import { D1PaymentRefundRepository } from "../../../modules/payments/infrastructure/D1PaymentRefundRepository";
import { paymentContext } from "./payments";

export function adminDashboardApplication(env: CloudflareEnv): AdminDashboardService {
  return new AdminDashboardService(new D1AdminDashboardQuery(env.DB));
}

export function adminNotificationsApplication(env: CloudflareEnv): AdminNotificationsService {
  return new AdminNotificationsService(new D1AdminNotificationsQuery(env.DB));
}

export async function adminPaymentsApplication(env: CloudflareEnv): Promise<AdminPayments> {
  const context = await paymentContext();
  return new AdminPayments(
    new D1PaymentAdminRepository(env.DB),
    new D1PaymentRefundRepository(env.DB),
    new D1PaymentLedgerRepository(env.DB),
    context.service,
    new D1PaymentAuditPort(env.DB),
  );
}
