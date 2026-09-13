import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminDashboardService } from "../../../../modules/admin/application/AdminDashboardService";
import { D1AdminDashboardQuery } from "../../../../modules/admin/infrastructure/D1AdminDashboardQuery";

export async function getAdminDashboard() {
  const { env } = getCloudflareContext();
  const query = new D1AdminDashboardQuery(env.DB);
  return new AdminDashboardService(query).execute();
}
