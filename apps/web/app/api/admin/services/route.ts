import { NextResponse } from "next/server";
import { listAdminServices } from "../../../../lib/api/adminServices";
import { requireAdmin, PERMISSIONS } from "../../../../lib/adminAuth";

export async function GET(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.servicesRead);
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    return NextResponse.json({ items: await listAdminServices(status as never) });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}
