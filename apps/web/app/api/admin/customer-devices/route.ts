import { NextResponse } from "next/server";
import { createAdminCustomerDevice, listAdminCustomerDevices } from "../../../../lib/api/adminCustomerDevices";

export async function GET(request: Request) {
  try { return NextResponse.json({ items: await listAdminCustomerDevices(new URL(request.url).searchParams.get("q")) }, { headers: { "cache-control": "no-store" } }); }
  catch (error) { const code = error instanceof Error ? error.message : ""; const status = code === "FORBIDDEN" ? 403 : 401; return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const device = await createAdminCustomerDevice(body as Record<string, unknown>);
    return NextResponse.json({ device: device.toPrimitives() }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 422;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : "Invalid device" }, { status });
  }
}
