import { NextResponse } from "next/server";
import { voidAdminPayment } from "../../../../../../lib/api/adminPayments";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const key = request.headers.get("Idempotency-Key") ?? "";
    const result = await voidAdminPayment(id, key);
    return NextResponse.json({ payment: result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "Payment not found" ? 404 : code.includes("Idempotency") || code.includes("idempotency") ? 400 : 409;
    return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : code }, { status });
  }
}
