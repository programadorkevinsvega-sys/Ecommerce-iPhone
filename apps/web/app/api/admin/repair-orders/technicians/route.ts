import { NextResponse } from "next/server";
import { repairOperationsApplication } from "../../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
export async function GET() { try { const { env } = await requireAdmin(PERMISSIONS.repairOrdersRead); return NextResponse.json({ items: await repairOperationsApplication(env).listTechnicians() }, { headers: { "cache-control": "no-store" } }); } catch (error) { const code=error instanceof Error?error.message:""; return NextResponse.json({ error: code === "FORBIDDEN" ? "Forbidden" : "Authentication required" }, { status: code === "FORBIDDEN" ? 403 : 401 }); } }
