import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ServiceRequestRepository } from "../../../../modules/services/infrastructure/D1ServiceRequestRepository";
import { D1ServiceTypeRepository } from "../../../../modules/services/infrastructure/D1ServiceTypeRepository";
import { ServiceWorkflowService, parseServiceRequestStatus } from "../../../../modules/services/application/ServiceWorkflowService";
import type { ServiceRequestStatus } from "../../../../modules/services/domain/ServiceRequest";
import { requireAdmin, PERMISSIONS } from "../adminAuth";

export { parseServiceRequestStatus };

async function context() {
  const { env } = await requireAdmin(PERMISSIONS.servicesRead);
  return { env, requests: new D1ServiceRequestRepository(env.DB), types: new D1ServiceTypeRepository(env.DB) };
}

export async function listAdminServices(status?: ServiceRequestStatus) {
  const { requests } = await context();
  return (await requests.listQueue(status)).map((item) => item.toPrimitives());
}

export async function getAdminService(id: string) {
  const { requests } = await context();
  const item = await requests.findById(id.trim());
  if (!item) throw new Error("NOT_FOUND");
  return item.toPrimitives();
}

export async function mutateAdminService(id: string, action: string, body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.servicesWrite);
  const { requests, types } = await context();
  const workflow = new ServiceWorkflowService(requests, types);
  if (action === "transition") return (await workflow.transition(id, parseServiceRequestStatus(body.status), admin.id)).toPrimitives();
  if (action === "quote") return (await workflow.quote(id, Number(body.amountInCents), admin.id)).toPrimitives();
  if (action === "assign") return (await workflow.assign(id, String(body.technicianId ?? ""), admin.id)).toPrimitives();
  if (action === "complete") return (await workflow.complete(id, String(body.notes ?? ""), admin.id)).toPrimitives();
  throw new Error("UNKNOWN_ACTION");
}
