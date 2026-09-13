import { NextResponse } from "next/server";
import { adminPaymentsApplication } from "../../../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../../../lib/adminAuth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.refundsCreate);
    const { id } = await context.params;
    const key = request.headers.get("Idempotency-Key") ?? "";
    const result = await (await adminPaymentsApplication(env)).refund(id, key, admin.id);
    return NextResponse.json({ payment: result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "Payment not found" ? 404 : code.includes("Idempotency") || code.includes("idempotency") ? 400 : 409;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : status === 404 ? "Payment not found" : code }, { status });
  }
}
