import { NextResponse } from "next/server";
import { technicianDeviceApplication } from "../../../../../lib/technicianApplication";
import { requireTechnician } from "../../../../../lib/technicianAuth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { env, technician } = await requireTechnician();
    const body = await request.json() as Record<string, unknown>;
    const device = await technicianDeviceApplication(env).update(
      technician.id,
      (await params).orderId,
      body,
    );
    return NextResponse.json(
      { device: device.toPrimitives() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "UNAUTHORIZED" ? 401 :
      code === "FORBIDDEN" ? 403 :
      code === "DEVICE_NOT_FOUND" || code === "DEVICE_NOT_LINKED" ? 404 : 400;
    return NextResponse.json(
      {
        error:
          status === 401 ? "Authentication required" :
          status === 403 ? "Forbidden" :
          status === 404 ? "Device not found" :
          "Unable to update device",
      },
      { status },
    );
  }
}
