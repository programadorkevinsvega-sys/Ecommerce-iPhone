import { NextResponse } from "next/server";
import { getAdminNotifications } from "../../../../lib/api/adminNotifications";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

export async function GET(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.dashboardRead);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    return NextResponse.json(await getAdminNotifications(limit), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}
