import { AdminDashboardService } from "../../../modules/admin/application/AdminDashboardService";
import { AdminNotificationsService } from "../../../modules/admin/application/AdminNotificationsService";
import { D1AdminDashboardQuery } from "../../../modules/admin/infrastructure/D1AdminDashboardQuery";
import { D1AdminNotificationsQuery } from "../../../modules/admin/infrastructure/D1AdminNotificationsQuery";

export function adminDashboardApplication(env: CloudflareEnv): AdminDashboardService {
  return new AdminDashboardService(new D1AdminDashboardQuery(env.DB));
}

export function adminNotificationsApplication(env: CloudflareEnv): AdminNotificationsService {
  return new AdminNotificationsService(new D1AdminNotificationsQuery(env.DB));
}
