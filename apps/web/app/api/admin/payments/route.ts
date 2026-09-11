import { NextResponse } from "next/server";
import { listAdminPayments } from "../../../../../lib/api/adminPayments";

export async function GET(request: Request) {
  try { return NextResponse.json(await listAdminPayments(new URL(request.url).searchParams), { headers: { "cache-control": "no-store" } }); }
  catch (error) { const code = error instanceof Error ? error.message : "UNKNOWN"; const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400; return NextResponse.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : "Unable to list payments" }, { status }); }
}
