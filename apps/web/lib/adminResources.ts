import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1AdminRepository } from "../../../modules/admin/infrastructure/D1AdminRepository";
import { D1AdminResourceRepository } from "../../../modules/admin/infrastructure/D1AdminResourceRepository";
import { AdminResources } from "../../../modules/admin/application/AdminResources";
import { publishNotificationEvent } from "./notifications";

export function adminResources() {
  const { env } = getCloudflareContext();
  const adminRepository = new D1AdminRepository(env.DB);
  const repository = new D1AdminResourceRepository(env.DB, adminRepository);
  const service = new AdminResources({ repository, publishNotification: publishNotificationEvent });
  return { service };
}
