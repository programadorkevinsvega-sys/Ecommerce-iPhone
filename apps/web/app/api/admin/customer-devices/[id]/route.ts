import { NextResponse } from "next/server";
import { archiveAdminCustomerDevice, restoreAdminCustomerDevice, updateAdminCustomerDevice } from "../../../../../lib/api/adminCustomerDevices";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const device = await updateAdminCustomerDevice((await params).id, body as Record<string, unknown>);
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });
    return NextResponse.json({ device: device.toPrimitives() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "DEVICE_CUSTOMER_IMMUTABLE" ? 409 : 422;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : status === 409 ? "Customer cannot be changed" : "Invalid device" }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body) || body.action !== "restore") {
      return NextResponse.json({ error: "Invalid device action" }, { status: 400 });
    }
    const restored = await restoreAdminCustomerDevice((await params).id);
    return restored ? NextResponse.json({ restored: true }, { headers: { "cache-control": "no-store" } }) : NextResponse.json({ error: "Device not found" }, { status: 404 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : "Forbidden" }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const archived = await archiveAdminCustomerDevice((await params).id);
    return archived ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Device not found" }, { status: 404 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : "Forbidden" }, { status });
  }
}
