import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  adminServiceDetailsApplication,
  adminServiceQueryApplication,
  serviceWorkflowApplication,
} from "../adminApplication";
import { requireAdmin, PERMISSIONS } from "../adminAuth";
import { parseServiceRequestStatus } from "../../../../modules/services/application/ServiceWorkflowService";
import type { ServiceRequestStatus } from "../../../../modules/services/domain/ServiceRequest";

export { parseServiceRequestStatus };

export async function listAdminServices(status?: ServiceRequestStatus) {
  const { env } = getCloudflareContext();
  const query = adminServiceQueryApplication(env);
  return (await query.list(status)).map((item) => item.toPrimitives());
}

export async function getAdminService(id: string) {
  const { env } = getCloudflareContext();
  const details = adminServiceDetailsApplication(env);
  return (await details.get(id)).toPrimitives();
}

export async function mutateAdminService(id: string, action: string, body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.servicesWrite);
  const { env } = getCloudflareContext();
  const workflow = serviceWorkflowApplication(env);
  if (action === "transition") return (await workflow.transition(id, parseServiceRequestStatus(body.status), admin.id)).toPrimitives();
  if (action === "quote") return (await workflow.quote(id, Number(body.amountInCents), admin.id)).toPrimitives();
  if (action === "assign") return (await workflow.assign(id, String(body.technicianId ?? ""), admin.id)).toPrimitives();
  if (action === "complete") return (await workflow.complete(id, String(body.notes ?? ""), admin.id)).toPrimitives();
  throw new Error("UNKNOWN_ACTION");
}
