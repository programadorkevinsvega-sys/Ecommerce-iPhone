import { NextResponse } from "next/server";
import { technicianDeviceApplication } from "../../../../../../modules/technicians/infrastructure/D1TechnicianComposition";
import { requireTechnician } from "../../../../lib/technicianAuth";

export async function GET() {
  try {
    const { env, technician } = await requireTechnician();
    return NextResponse.json({ items: await technicianDeviceApplication(env).list(technician.id) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : "Unable to load devices" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { env, technician } = await requireTechnician();
    const body = await request.json() as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) throw new Error("REPAIR_ORDER_REQUIRED");
    const device = await technicianDeviceApplication(env).create(technician.id, orderId, body);
    return NextResponse.json({ device: device.toPrimitives() }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "DEVICE_ALREADY_LINKED" ? 409 : code === "REPAIR_ORDER_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : status === 409 ? "The order already has a registered device" : status === 404 ? "Repair order not found" : "Unable to register device" }, { status });
  }
}