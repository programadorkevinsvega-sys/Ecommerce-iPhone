import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminDashboardApplication } from "../adminApplication";

export async function getAdminDashboard(adminUserId: string) {
  const { env } = getCloudflareContext();
  return adminDashboardApplication(env).execute(adminUserId);
}
