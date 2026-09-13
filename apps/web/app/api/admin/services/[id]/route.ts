import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminServiceDetailsApplication, serviceWorkflowApplication } from "../../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { parseServiceRequestStatus } from "../../../../../modules/services/domain/ServiceRequest";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(PERMISSIONS.servicesRead);
    const { id } = await context.params;
    const { env } = getCloudflareContext();
    return NextResponse.json({ service: (await adminServiceDetailsApplication(env).get(id)).toPrimitives() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load service";
    const status = message === "Service request not found" ? 404 : message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 404 ? "Service request not found" : status === 403 ? "Forbidden" : status === 401 ? "Authentication required" : message }, { status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin(PERMISSIONS.servicesWrite);
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "").trim().toLowerCase();
    if (!["transition", "quote", "assign", "complete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const { env } = getCloudflareContext();
    const workflow = serviceWorkflowApplication(env);
    if (action === "transition") {
      return NextResponse.json({ service: (await workflow.transition(id, parseServiceRequestStatus(body.status), admin.id)).toPrimitives() });
    }
    if (action === "quote") {
      return NextResponse.json({ service: (await workflow.quote(id, Number(body.amountInCents), admin.id)).toPrimitives() });
    }
    if (action === "assign") {
      return NextResponse.json({ service: (await workflow.assign(id, String(body.technicianId ?? ""), admin.id)).toPrimitives() });
    }
    return NextResponse.json({ service: (await workflow.complete(id, String(body.notes ?? ""), admin.id)).toPrimitives() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update service";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : status === 401 ? "Authentication required" : message }, { status });
  }
}
