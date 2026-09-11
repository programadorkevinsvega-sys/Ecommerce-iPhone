import { NextResponse } from "next/server";
import { getAdminPayment } from "../../../../../lib/api/adminPayments";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; if (!id.trim()) return NextResponse.json({ error: "Payment id required" }, { status: 400 }); return NextResponse.json(await getAdminPayment(id), { headers: { "cache-control": "no-store" } }); }
  catch (error) { const code = error instanceof Error ? error.message : "UNKNOWN"; const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "PAYMENT_NOT_FOUND" ? 404 : 400; return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : status === 404 ? "Payment not found" : "Unable to read payment" }, { status }); }
}
