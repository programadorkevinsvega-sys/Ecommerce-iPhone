import { NextResponse } from "next/server";
import { repairOperationsApplication, repairOrderRepository } from "../../../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../../../lib/adminAuth";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.repairOrdersWrite);
    if (admin.role === "TECHNICIAN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const id = (await params).id;
    if (!(await repairOrderRepository(env).findById(id))) return NextResponse.json({ error: "Repair order not found" }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const technicianId = typeof body.technicianId === "string" ? body.technicianId.trim() : "";
    if (!technicianId) return NextResponse.json({ error: "Technician is required" }, { status: 400 });
    if (!(await repairOperationsApplication(env).isActiveTechnician(technicianId))) return NextResponse.json({ error: "Invalid technician" }, { status: 400 });
    await repairOperationsApplication(env).assign(id, technicianId, admin.id);
    return NextResponse.json({ assigned: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "FORBIDDEN" ? "Forbidden" : code === "UNAUTHORIZED" ? "Authentication required" : "Unable to assign technician" }, { status: code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : 400, headers: { "cache-control": "no-store" } });
  }
}
