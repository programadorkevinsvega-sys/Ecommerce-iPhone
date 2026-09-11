import { D1AdminNotificationsQuery } from "../../../../modules/admin/infrastructure/D1AdminNotificationsQuery";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function getAdminNotifications(limit: number) {
  const { env } = await requireAdmin(PERMISSIONS.dashboardRead);
  return new D1AdminNotificationsQuery(env.DB).execute(limit);
}
