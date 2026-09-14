import { NextResponse } from "next/server";
import { repairOrderManagementApplication, repairOrderRepository } from "../../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import type { RepairOrderStatus } from "../../../../../../../modules/repairs/domain/RepairOrder";

function responseFor(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code.includes("NOT_FOUND") ? 404 : code === "INVALID_REPAIR_TRANSITION" ? 409 : 400;
  const message = status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : status === 404 ? "Repair order not found" : status === 409 ? "Invalid repair order transition" : "Unable to process repair order";
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.repairOrdersRead);
    const order = await repairOrderRepository(env).findById((await params).id);
    if (!order) return NextResponse.json({ error: "Repair order not found" }, { status: 404, headers: { "cache-control": "no-store" } });
    if (admin.role === "TECHNICIAN" && order.toPrimitives().assignedTechnicianId !== admin.id) return responseFor(new Error("FORBIDDEN"));
    return NextResponse.json({ order: order.toPrimitives() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseFor(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.repairOrdersWrite);
    const id = (await params).id;
    const existing = await repairOrderManagementApplication(env).get(id);
    if (admin.role === "TECHNICIAN" && existing.toPrimitives().assignedTechnicianId !== admin.id) return responseFor(new Error("FORBIDDEN"));
    const body = await request.json() as Record<string, unknown>;
    const status = typeof body.status === "string" ? body.status as RepairOrderStatus : null;
    const manager = repairOrderManagementApplication(env);
    if (!status) {
      const rawConditions = Array.isArray(body.conditions) ? body.conditions : [];
      const conditions = rawConditions.map((item) => { if (!item || typeof item !== "object") throw new Error("INVALID_REPAIR_CONDITIONS"); const value = item as Record<string, unknown>; return { component: String(value.component ?? ""), condition: String(value.condition ?? "NOT_TESTED") as "FUNCTIONAL" | "NOT_FUNCTIONAL" | "DAMAGED" | "NOT_TESTED" | "NOT_APPLICABLE", ...(value.notes ? { notes: String(value.notes) } : {}) }; });
      const order = await manager.updateTechnicalRecord(id, { diagnosisSummary: typeof body.diagnosisSummary === "string" ? body.diagnosisSummary : null, workSummary: typeof body.workSummary === "string" ? body.workSummary : null, conditions }, admin.id);
      return NextResponse.json({ order: order.toPrimitives() }, { headers: { "cache-control": "no-store" } });
    }
    if (admin.role === "TECHNICIAN" && !["DIAGNOSING", "WAITING_PART", "IN_REPAIR", "QUALITY_CONTROL"].includes(status)) return responseFor(new Error("FORBIDDEN"));
    const order = await manager.transition(id, status, admin.id);
    return NextResponse.json({ order: order.toPrimitives() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseFor(error);
  }
}
