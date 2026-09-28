import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminResources } from "../../../modules/admin/application/AdminResources";
import { D1AdminResourceAuditPort } from "../../../modules/admin/infrastructure/D1AdminResourceAuditPort";
import { D1AdminResourceRepository } from "../../../modules/admin/infrastructure/D1AdminResourceRepository";
import { publishNotificationEvent } from "./notifications";
import { assertOrderTransition, type OrderStatus } from "../../../modules/orders/domain/Order";
import { assertServiceRequestTransition, type ServiceRequestStatus } from "../../../modules/services/domain/ServiceRequest";

export function adminResources() {
  const { env } = getCloudflareContext();
  const repository = new D1AdminResourceRepository(env.DB, (from, to) => assertOrderTransition(from as OrderStatus, to as OrderStatus), (from, to) => assertServiceRequestTransition(from as ServiceRequestStatus, to as ServiceRequestStatus));
  const audit = new D1AdminResourceAuditPort(env.DB);
  const service = new AdminResources({ repository, audit, publishNotification: publishNotificationEvent });
  return { service };
}
