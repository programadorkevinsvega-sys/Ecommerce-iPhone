import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminNotificationsApplication } from "../adminApplication";

export async function getAdminNotifications(limit: number) {
  const { env } = getCloudflareContext();
  return adminNotificationsApplication(env).execute(limit);
}
