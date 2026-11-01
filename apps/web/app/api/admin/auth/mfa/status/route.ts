import { NextResponse } from "next/server";
import { currentAdmin } from "../../../../../../lib/adminAuth";
import { cloudflareEnv } from "../../../../../../lib/cloudflareContext";
import { getAdminMfaStatus } from "../../../../../../lib/adminMfa";

export async function GET() {
  try {
    const admin = await currentAdmin();
    if (!admin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const result = await getAdminMfaStatus(cloudflareEnv(), admin.id);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to read MFA status" }, { status: 500 });
  }
}
