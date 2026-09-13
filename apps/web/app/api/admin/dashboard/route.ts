import { NextResponse } from "next/server";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";
import { adminDashboardApplication } from "../../../../lib/adminApplication";

export async function GET() {
  try {
    const { admin, env } = await requireAdmin(PERMISSIONS.dashboardRead);
    const dashboard = await adminDashboardApplication(env).execute(admin.id);
    return NextResponse.json(dashboard);
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}
