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
    const { env } = await requireAdmin(PERMISSIONS.repairOrdersRead);
    const order = await repairOrderRepository(env).findById((await params).id);
    if (!order) return NextResponse.json({ error: "Repair order not found" }, { status: 404, headers: { "cache-control": "no-store" } });
    return NextResponse.json({ order: order.toPrimitives() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseFor(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.repairOrdersWrite);
    const body = await request.json() as Record<string, unknown>;
    const status = typeof body.status === "string" ? body.status as RepairOrderStatus : null;
    if (!status) return responseFor(new Error("INVALID_REPAIR_STATUS"));
    const order = await repairOrderManagementApplication(env).transition((await params).id, status, admin.id);
    return NextResponse.json({ order: order.toPrimitives() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseFor(error);
  }
}
