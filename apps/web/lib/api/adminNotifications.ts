import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminNotificationsService } from "../../../../modules/admin/application/AdminNotificationsService";
import { D1AdminNotificationsQuery } from "../../../../modules/admin/infrastructure/D1AdminNotificationsQuery";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function getAdminNotifications(limit: number) {
  await requireAdmin(PERMISSIONS.dashboardRead);
  const { env } = getCloudflareContext();
  return new AdminNotificationsService(new D1AdminNotificationsQuery(env.DB)).execute(limit);
}
