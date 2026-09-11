import { NextResponse } from "next/server";
import { listAdminServices } from "../../../../lib/api/adminServices";
import { requireAdmin, PERMISSIONS } from "../../../../lib/adminAuth";
import type { ServiceRequestStatus } from "../../../../modules/services/domain/ServiceRequest";

const statuses: readonly ServiceRequestStatus[] = ["PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"];

export async function GET(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.servicesRead);
    const raw = new URL(request.url).searchParams.get("status");
    if (raw && !statuses.includes(raw as ServiceRequestStatus)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    return NextResponse.json({ items: await listAdminServices(raw as ServiceRequestStatus | undefined) });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}
