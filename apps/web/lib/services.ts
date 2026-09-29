import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ServiceCustomerPortal } from "../../../modules/services/application/ServiceCustomerPortal";
import { D1ServiceRequestRepository } from "../../../modules/services/infrastructure/D1ServiceRequestRepository";
import { D1ServiceTypeRepository } from "../../../modules/services/infrastructure/D1ServiceTypeRepository";
import { ServiceRequestFactory } from "../../../modules/services/infrastructure/ServiceRequestFactory";

export function serviceCustomerPortal() {
  const { env } = getCloudflareContext();
  return new ServiceCustomerPortal(new D1ServiceRequestRepository(env.DB), new D1ServiceTypeRepository(env.DB), new ServiceRequestFactory());
}

export async function listPublicServices() {
  const { env } = await getCloudflareContext({ async: true });
  return new D1ServiceTypeRepository(env.DB).listEnabled();
}
