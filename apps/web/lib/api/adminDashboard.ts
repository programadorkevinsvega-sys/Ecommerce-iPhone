import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminDashboardApplication } from "../adminApplication";

export async function getAdminDashboard() {
  const { env } = getCloudflareContext();
  return adminDashboardApplication(env).execute();
}
