import { NextResponse } from "next/server";
import { listAdminServices } from "../../../../lib/api/adminServices";
import { requireAdmin, PERMISSIONS } from "../../../../lib/adminAuth";
import { parseServiceRequestStatus } from "../../../../../modules/services/application/ServiceWorkflowService";
import type { ServiceRequestStatus } from "../../../../../modules/services/domain/ServiceRequest";

export async function GET(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.servicesRead);
    const raw = new URL(request.url).searchParams.get("status");
    const status = raw ? parseServiceRequestStatus(raw) : undefined;
    return NextResponse.json({ items: await listAdminServices(status as ServiceRequestStatus | undefined) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load services";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : status === 401 ? "Authentication required" : message }, { status });
  }
}
