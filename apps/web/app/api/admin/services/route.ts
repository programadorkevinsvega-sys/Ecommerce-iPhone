import { NextResponse } from "next/server";
import { listAdminServices, parseServiceRequestStatus } from "../../../../lib/api/adminServices";
import { requireAdmin, PERMISSIONS } from "../../../../lib/adminAuth";

export async function GET(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.servicesRead);
    const raw = new URL(request.url).searchParams.get("status");
    const status = raw ? parseServiceRequestStatus(raw) : undefined;
    return NextResponse.json({ items: await listAdminServices(status) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load services";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : status === 401 ? "Authentication required" : message }, { status });
  }
}
