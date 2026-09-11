import { NextResponse } from "next/server";
import { createAdminServiceType, listAdminServiceTypes } from "../../../../lib/api/adminServiceTypes";

export async function GET() {
  try {
    return NextResponse.json({ items: await listAdminServiceTypes() });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    return NextResponse.json({ created: true, serviceType: await createAdminServiceType(body as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid service type" }, { status: 400 });
  }
}
