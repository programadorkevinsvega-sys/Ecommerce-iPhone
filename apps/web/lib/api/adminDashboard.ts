import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1AdminDashboardQuery } from "../../../../modules/admin/infrastructure/D1AdminDashboardQuery";

export async function getAdminDashboard() {
  const { env } = getCloudflareContext();
  const query = new D1AdminDashboardQuery(env.DB);
  return query.execute();
}
