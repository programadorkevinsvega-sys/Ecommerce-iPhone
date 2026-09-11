import { NextResponse } from "next/server";
import { AdminAuditViewer } from "../../../../../../modules/admin/application/AdminAuditViewer";
import { D1AdminAuditRepository } from "../../../../../../modules/admin/infrastructure/D1AdminAuditRepository";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

const optional = (value: string | null) => value?.trim() || undefined;
const validDate = (value: string | undefined) => !value || !Number.isNaN(Date.parse(value));

export async function GET(request: Request) {
  try {
    const { env } = await requireAdmin(PERMISSIONS.auditRead);
    const { searchParams } = new URL(request.url);
    const limitValue = Number(searchParams.get("limit") ?? "50");
    const offsetValue = Number(searchParams.get("offset") ?? "0");
    const limit = Number.isInteger(limitValue) ? limitValue : 50;
    const offset = Number.isInteger(offsetValue) ? offsetValue : 0;
    const filter = {
      adminUserId: optional(searchParams.get("adminUserId")),
      action: optional(searchParams.get("action")),
      resourceType: optional(searchParams.get("resourceType")),
      resourceId: optional(searchParams.get("resourceId")),
      from: optional(searchParams.get("from")),
      to: optional(searchParams.get("to")),
      limit,
      offset,
    };
    if (offset < 0 || limit < 1 || limit > 100 || !validDate(filter.from) || !validDate(filter.to)) {
      return NextResponse.json({ error: "Invalid audit filters" }, { status: 400 });
    }
    const result = await new AdminAuditViewer(new D1AdminAuditRepository(env.DB)).execute(filter);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { error: code === "FORBIDDEN" ? "Forbidden" : code === "UNAUTHORIZED" ? "Authentication required" : "Unable to read audit log" },
      { status: code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : 400 },
    );
  }
}
