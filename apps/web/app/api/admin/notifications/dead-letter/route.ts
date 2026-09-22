import { NextResponse } from "next/server";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { listNotificationDeadLetters } from "../../../../../lib/api/notifications";

export async function GET(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.dashboardRead);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    return NextResponse.json({ items: await listNotificationDeadLetters(limit) }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}
