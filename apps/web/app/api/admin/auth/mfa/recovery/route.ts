import { NextResponse } from "next/server";
import { currentAdmin } from "../../../../../../lib/adminAuth";
import { cloudflareEnv } from "../../../../../../lib/cloudflareContext";
import { regenerateAdminMfaRecoveryCodes } from "../../../../../../lib/adminMfa";

export async function POST(request: Request) {
  try {
    const admin = await currentAdmin();
    if (!admin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = (await request.json()) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!password || password.length > 128 || !code || code.length > 40) {
      return NextResponse.json({ error: "Invalid reauthentication input" }, { status: 422 });
    }
    const recoveryCodes = await regenerateAdminMfaRecoveryCodes(cloudflareEnv(), {
      adminUserId: admin.id,
      password,
      code,
    });
    return NextResponse.json({ recoveryCodes }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "ACCOUNT_LOCKED"
        ? 423
        : code === "INVALID_CREDENTIALS" ||
            code === "INVALID_MFA_CODE" ||
            code === "MFA_CODE_REUSED" ||
            code === "ADMIN_MFA_REQUIRED"
          ? 401
          : code.startsWith("ADMIN_MFA_CONFIGURATION")
            ? 503
            : 400;
    return NextResponse.json(
      { error: status === 503 ? "MFA configuration unavailable" : "Reauthentication failed" },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
