import { AdminAuditViewer } from "../../../modules/admin/application/AdminAuditViewer";
import { AdminPromotions } from "../../../modules/promotions/application/AdminPromotions";
import { AdminCoupons } from "../../../modules/promotions/application/AdminCoupons";
import { AdminContent } from "../../../modules/cms/application/AdminContent";
import { D1CmsContentRepository } from "../../../modules/cms/infrastructure/D1CmsContentRepository";
import { AdminReviews } from "../../../modules/reviews/application/AdminReviews";
import { AdminDashboardService } from "../../../modules/admin/application/AdminDashboardService";
import { AdminNotificationsService } from "../../../modules/admin/application/AdminNotificationsService";
import { AdminUserManagement } from "../../../modules/admin/application/AdminUserManagement";
import { D1AdminAuditRepository } from "../../../modules/admin/infrastructure/D1AdminAuditRepository";
import { D1PromotionRepository } from "../../../modules/promotions/infrastructure/D1PromotionRepository";
import { D1CouponRepository } from "../../../modules/promotions/infrastructure/D1CouponRepository";
import { D1AdminReviewRepository } from "../../../modules/reviews/infrastructure/D1AdminReviewRepository";
import { D1AdminDashboardQuery } from "../../../modules/admin/infrastructure/D1AdminDashboardQuery";
import { D1AdminNotificationsQuery } from "../../../modules/admin/infrastructure/D1AdminNotificationsQuery";
import { D1AdminPasswordHasher } from "../../../modules/admin/infrastructure/D1AdminPasswordHasher";
import { D1AdminSessionRepository } from "../../../modules/admin/infrastructure/D1AdminSessionRepository";
import { D1AdminUserAuditPort } from "../../../modules/admin/infrastructure/D1AdminUserAuditPort";
import { D1AdminUserRepository } from "../../../modules/admin/infrastructure/D1AdminUserRepository";
import { AdminPermissionManagement } from "../../../modules/admin/application/AdminPermissionManagement";
import { D1AdminPermissionRepository } from "../../../modules/admin/infrastructure/D1AdminPermissionRepository";
import { D1AdminSettingsRepository } from "../../../modules/admin/infrastructure/D1AdminSettingsRepository";
import { D1AuditPort } from "../../../modules/admin/infrastructure/D1AuditPort";
import { ReviewModeration } from "../../../modules/reviews/application/ReviewModeration";
import { D1ReviewModerationRepository } from "../../../modules/reviews/infrastructure/D1ReviewModerationRepository";
import { AdminCampaigns } from "../../../modules/promotions/application/AdminCampaigns";
import { D1CampaignRepository } from "../../../modules/promotions/infrastructure/D1CampaignRepository";
import { AdminSettings } from "../../../modules/admin/application/AdminSettings";
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
import { AdminCms } from "../../../modules/cms/application/AdminCms";
import { D1CmsRepository } from "../../../modules/cms/infrastructure/D1CmsRepository";
import { AdminInventory } from "../../../modules/inventory/application/AdminInventory";
import { D1InventoryRepository } from "../../../modules/inventory/infrastructure/D1InventoryRepository";
import { AdminCategories } from "../../../modules/catalog/application/Categories";
import { D1CategoryRepository } from "../../../modules/catalog/infrastructure/D1CategoryRepository";
import type { ServiceRequestRepository } from "../../../modules/services/application/ServiceRequestRepository";
import type { ServiceTypeRepository } from "../../../modules/services/application/ServiceTypeRepository";
import { CreateRepairOrder } from "../../../modules/repairs/application/CreateRepairOrder";
import { RepairOrderManagement } from "../../../modules/repairs/application/RepairOrderManagement";
import { D1RepairOrderRepository } from "../../../modules/repairs/infrastructure/D1RepairOrderRepository";
import { RepairTracking } from "../../../modules/repairs/application/RepairTracking";
import { RepairEvidenceService } from "../../../modules/repairs/application/RepairEvidence";
import { D1RepairEvidenceRepository } from "../../../modules/repairs/infrastructure/D1RepairEvidenceRepository";
import { RepairOperations } from "../../../modules/repairs/application/RepairOperations";
import { D1RepairOperationsRepository } from "../../../modules/repairs/infrastructure/D1RepairOperationsRepository";

export function adminDashboardApplication(env: CloudflareEnv): AdminDashboardService {
  return new AdminDashboardService(new D1AdminDashboardQuery(env.DB), new D1AuditPort(env.DB));
}

export function adminAuditApplication(env: CloudflareEnv): AdminAuditViewer {
  return new AdminAuditViewer(new D1AdminAuditRepository(env.DB));
}

export function adminPromotionsApplication(env: CloudflareEnv): AdminPromotions {
  return new AdminPromotions(new D1PromotionRepository(env.DB), new D1AuditPort(env.DB));
}

export function adminCouponsApplication(env: CloudflareEnv): AdminCoupons { return new AdminCoupons(new D1CouponRepository(env.DB), new D1AuditPort(env.DB)); }

export function adminContentApplication(env: CloudflareEnv): AdminContent { return new AdminContent(new D1CmsContentRepository(env.DB), new D1AuditPort(env.DB)); }

export function reviewModerationApplication(env: CloudflareEnv): ReviewModeration { return new ReviewModeration(new D1ReviewModerationRepository(env.DB), new D1AuditPort(env.DB)); }

export function adminCampaignsApplication(env: CloudflareEnv): AdminCampaigns { return new AdminCampaigns(new D1CampaignRepository(env.DB), new D1AuditPort(env.DB)); }

export function adminReviewsApplication(env: CloudflareEnv): AdminReviews {
  return new AdminReviews(new D1AdminReviewRepository(env.DB), new D1AuditPort(env.DB));
}

export function adminNotificationsApplication(env: CloudflareEnv): AdminNotificationsService {
  return new AdminNotificationsService(new D1AdminNotificationsQuery(env.DB));
}

export function adminCmsApplication(env: CloudflareEnv): AdminCms {
  return new AdminCms(new D1CmsRepository(env.DB), new D1AuditPort(env.DB));
}

export function adminSettingsApplication(env: CloudflareEnv): AdminSettings {
  return new AdminSettings(new D1AdminSettingsRepository(env.DB), new D1AuditPort(env.DB));
}

export function adminInventoryApplication(env: CloudflareEnv): AdminInventory {
  return new AdminInventory(new D1InventoryRepository(env.DB), new D1AuditPort(env.DB));
}

export function adminCategoriesApplication(env: CloudflareEnv): AdminCategories {
  return new AdminCategories(new D1CategoryRepository(env.DB), new D1AuditPort(env.DB));
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

export function adminPermissionManagementApplication(env: CloudflareEnv): AdminPermissionManagement {
  return new AdminPermissionManagement(
    new D1AdminUserRepository(env.DB),
    new D1AdminPermissionRepository(env.DB),
    new D1AuditPort(env.DB),
  );
}

export function repairOrderRepository(env: CloudflareEnv): D1RepairOrderRepository {
  return new D1RepairOrderRepository(env.DB);
}

export function createRepairOrderApplication(env: CloudflareEnv): CreateRepairOrder {
  return new CreateRepairOrder(serviceRequestRepository(env), repairOrderRepository(env));
}

export function repairOrderManagementApplication(env: CloudflareEnv): RepairOrderManagement {
  return new RepairOrderManagement(repairOrderRepository(env));
}
export function repairTrackingApplication(env: CloudflareEnv): RepairTracking { return new RepairTracking(repairOrderRepository(env), new D1RepairOperationsRepository(env.DB)); }
export function repairEvidenceApplication(env: CloudflareEnv): RepairEvidenceService { return new RepairEvidenceService(new D1RepairEvidenceRepository(env.DB)); }
export function repairOperationsApplication(env: CloudflareEnv): RepairOperations { return new RepairOperations(new D1RepairOperationsRepository(env.DB)); }
