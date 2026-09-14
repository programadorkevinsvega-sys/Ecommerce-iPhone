import { NextResponse } from "next/server";
import { createRepairOrderApplication, repairOrderRepository } from "../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";
import type { RepairOrderStatus } from "../../../../../../modules/repairs/domain/RepairOrder";

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

function responseFor(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code.includes("NOT_FOUND") ? 404 : code === "REPAIR_ORDER_ALREADY_EXISTS" ? 409 : 400;
  const message = status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : status === 404 ? "Repair request not found" : status === 409 ? "A repair order already exists for this request" : "Unable to process repair order";
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.repairOrdersRead);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus ? rawStatus as RepairOrderStatus : undefined;
    const items = await repairOrderRepository(env).list({ ...(status ? { status } : {}), ...(admin.role === "TECHNICIAN" ? { technicianId: admin.id } : {}), limit: Number(url.searchParams.get("limit") ?? 50) });
    return NextResponse.json({ items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.repairOrdersWrite);
    if (admin.role === "TECHNICIAN") return responseFor(new Error("FORBIDDEN"));
    const body = bodyRecord(await request.json());
    const serviceRequestId = typeof body.serviceRequestId === "string" ? body.serviceRequestId : "";
    const order = await createRepairOrderApplication(env).execute(serviceRequestId, admin.id);
    return NextResponse.json({ order: order.toPrimitives() }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseFor(error);
  }
}
