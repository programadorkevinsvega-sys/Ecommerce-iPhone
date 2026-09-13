import { AdminDashboardService } from "../../../modules/admin/application/AdminDashboardService";
import { AdminNotificationsService } from "../../../modules/admin/application/AdminNotificationsService";
import { AdminUserManagement } from "../../../modules/admin/application/AdminUserManagement";
import { D1AdminDashboardQuery } from "../../../modules/admin/infrastructure/D1AdminDashboardQuery";
import { D1AdminNotificationsQuery } from "../../../modules/admin/infrastructure/D1AdminNotificationsQuery";
import { D1AdminPasswordHasher } from "../../../modules/admin/infrastructure/D1AdminPasswordHasher";
import { D1AdminSessionRepository } from "../../../modules/admin/infrastructure/D1AdminSessionRepository";
import { D1AdminUserAuditPort } from "../../../modules/admin/infrastructure/D1AdminUserAuditPort";
import { D1AdminUserRepository } from "../../../modules/admin/infrastructure/D1AdminUserRepository";
import { AdminPayments } from "../../../modules/payments/application/AdminPayments";
import { D1PaymentAdminRepository } from "../../../modules/payments/infrastructure/D1PaymentAdminRepository";
import { D1PaymentAuditPort } from "../../../modules/payments/infrastructure/D1PaymentAuditPort";
import { D1PaymentLedgerRepository } from "../../../modules/payments/infrastructure/D1PaymentLedgerRepository";
import { D1PaymentRefundRepository } from "../../../modules/payments/infrastructure/D1PaymentRefundRepository";
import { AdminServiceDetailsService } from "../../../modules/services/application/AdminServiceDetails";
import { AdminServiceQueryService } from "../../../modules/services/application/AdminServiceQuery";
import { AdminServiceTypes } from "../../../modules/services/application/AdminServiceTypes";
import { ServiceWorkflowService } from "../../../modules/services/application/ServiceWorkflowService";
import { D1ServiceRequestRepository } from "../../../modules/services/infrastructure/D1ServiceRequestRepository";
import { D1ServiceTypeAuditPort } from "../../../modules/services/infrastructure/D1ServiceTypeAuditPort";
import { D1ServiceTypeRepository } from "../../../modules/services/infrastructure/D1ServiceTypeRepository";
import type { ServiceRequestRepository } from "../../../modules/services/application/ServiceRequestRepository";
import type { ServiceTypeRepository } from "../../../modules/services/application/ServiceTypeRepository";

export function adminDashboardApplication(env: CloudflareEnv): AdminDashboardService {
  return new AdminDashboardService(new D1AdminDashboardQuery(env.DB));
}

export function adminNotificationsApplication(env: CloudflareEnv): AdminNotificationsService {
  return new AdminNotificationsService(new D1AdminNotificationsQuery(env.DB));
}

export async function adminPaymentsApplication(env: CloudflareEnv): Promise<AdminPayments> {
  const { paymentContext } = await import("./payments");
  const context = await paymentContext();
  return new AdminPayments(
    new D1PaymentAdminRepository(env.DB),
    new D1PaymentRefundRepository(env.DB),
    new D1PaymentLedgerRepository(env.DB),
    context.service,
    new D1PaymentAuditPort(env.DB),
  );
}

function serviceRequestRepository(env: CloudflareEnv): ServiceRequestRepository {
  return new D1ServiceRequestRepository(env.DB);
}

function serviceTypeRepository(env: CloudflareEnv): ServiceTypeRepository {
  return new D1ServiceTypeRepository(env.DB);
}

export function adminServiceQueryApplication(env: CloudflareEnv): AdminServiceQueryService {
  return new AdminServiceQueryService(serviceRequestRepository(env));
}

export function adminServiceDetailsApplication(env: CloudflareEnv): AdminServiceDetailsService {
  return new AdminServiceDetailsService(serviceRequestRepository(env));
}

export function serviceWorkflowApplication(env: CloudflareEnv): ServiceWorkflowService {
  return new ServiceWorkflowService(serviceRequestRepository(env), serviceTypeRepository(env));
}

export function adminServiceTypesApplication(env: CloudflareEnv): AdminServiceTypes {
  return new AdminServiceTypes(serviceTypeRepository(env), new D1ServiceTypeAuditPort(env.DB));
}

export function adminUserManagementApplication(env: CloudflareEnv): AdminUserManagement {
  return new AdminUserManagement(
    new D1AdminUserRepository(env.DB),
    new D1AdminPasswordHasher(),
    new D1AdminSessionRepository(env.DB),
    new D1AdminUserAuditPort(env.DB),
  );
}
