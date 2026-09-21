import { NextResponse } from "next/server";
import { requireTechnician } from "../../../../../lib/technicianAuth";
import { technicianRepairOrderApplication } from "../../../../../lib/technicianApplication";

const allowed = ["DIAGNOSING", "WAITING_PART", "IN_REPAIR", "QUALITY_CONTROL"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { env, technician } = await requireTechnician();
    const order = await technicianRepairOrderApplication(env).getAssigned(
      (await params).id,
      technician.id,
    );
    return NextResponse.json(
      { order: order.toPrimitives() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "UNAUTHORIZED" ? 401 :
      code === "FORBIDDEN" ? 403 :
      code === "REPAIR_ORDER_NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      {
        error:
          status === 401 ? "Authentication required" :
          status === 403 ? "Forbidden" :
          status === 404 ? "Repair order not found" :
          "Unable to load order",
      },
      { status },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { env, technician } = await requireTechnician();
    const id = (await params).id;
    const body = await request.json() as Record<string, unknown>;
    const manager = technicianRepairOrderApplication(env);

    if (typeof body.status === "string") {
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: "Forbidden transition" }, { status: 403 });
      }
      const order = await manager.transitionAssigned(id, body.status, technician.id);
      return NextResponse.json({ order: order.toPrimitives() });
    }

    const raw = Array.isArray(body.conditions) ? body.conditions : [];
    const conditions = raw.map((item) => {
      if (!item || typeof item !== "object") throw new Error("INVALID_CONDITIONS");
      const value = item as Record<string, unknown>;
      return {
        component: String(value.component ?? ""),
        condition: String(value.condition ?? "NOT_TESTED"),
        ...(typeof value.notes === "string" ? { notes: value.notes } : {}),
      };
    });

    const order = await manager.updateTechnicalRecordAssigned(
      id,
      {
        diagnosisSummary:
          typeof body.diagnosisSummary === "string" ? body.diagnosisSummary : null,
        workSummary:
          typeof body.workSummary === "string" ? body.workSummary : null,
        conditions,
      },
      technician.id,
    );
    return NextResponse.json({ order: order.toPrimitives() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "UNAUTHORIZED" ? 401 :
      code === "FORBIDDEN" ? 403 :
      code === "REPAIR_ORDER_NOT_FOUND" ? 404 :
      code === "INVALID_REPAIR_TRANSITION" ? 409 : 400;
    return NextResponse.json(
      {
        error:
          status === 401 ? "Authentication required" :
          status === 403 ? "Forbidden" :
          status === 404 ? "Repair order not found" :
          status === 409 ? "Invalid transition" :
          "Unable to update order",
      },
      { status },
    );
  }
}
