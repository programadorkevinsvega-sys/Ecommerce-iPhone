import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { getAdminDashboard } from "../../../../lib/api/adminDashboard";
import { PERMISSIONS } from "../../../../../../modules/admin/infrastructure/AdminSecurity";

export async function GET() {
  try {
    const { admin, repo } = await requireAdmin(PERMISSIONS.dashboardRead);
    const dashboard = await getAdminDashboard();
    await repo.audit(admin.id, "ADMIN_DASHBOARD_VIEW", "dashboard", null, {});
    return NextResponse.json(dashboard);
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}
