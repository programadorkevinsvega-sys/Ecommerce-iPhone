import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminResources } from "../../../modules/admin/application/AdminResources";
import { D1AdminResourceAuditPort } from "../../../modules/admin/infrastructure/D1AdminResourceAuditPort";
import { D1AdminResourceRepository } from "../../../modules/admin/infrastructure/D1AdminResourceRepository";
import { publishNotificationEvent } from "./notifications";

export function adminResources() {
  const { env } = getCloudflareContext();
  const repository = new D1AdminResourceRepository(env.DB);
  const audit = new D1AdminResourceAuditPort(env.DB);
  const service = new AdminResources({ repository, audit, publishNotification: publishNotificationEvent });
  return { service };
}
