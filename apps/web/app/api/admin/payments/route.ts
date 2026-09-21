import { NextResponse } from "next/server";
import { adminPaymentsApplication } from "../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

export async function GET(request: Request) {
  try {
    const { env } = await requireAdmin(PERMISSIONS.paymentsRead);
    const url = new URL(request.url);
    const application = await adminPaymentsApplication(env);
    const result = await application.list({
      ...(url.searchParams.get("status") ? { status: url.searchParams.get("status")!.toUpperCase() as never } : {}),
      ...(url.searchParams.get("provider") ? { provider: url.searchParams.get("provider")!.toUpperCase() as never } : {}),
      limit: Number(url.searchParams.get("limit") ?? 50),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      { error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : "Unable to list payments" },
      { status },
    );
  }
}
