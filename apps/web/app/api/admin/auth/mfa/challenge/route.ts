import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cloudflareEnv } from "../../../../../../lib/cloudflareContext";
import { ADMIN_MFA_CHALLENGE_COOKIE } from "../../../../../../lib/adminAuth";
import { readAdminMfaChallenge } from "../../../../../../lib/adminMfa";

export async function GET() {
  try {
    const token = (await cookies()).get(ADMIN_MFA_CHALLENGE_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "MFA challenge required" }, { status: 401 });
    const challenge = await readAdminMfaChallenge(cloudflareEnv(), token);
    return NextResponse.json(challenge, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code.startsWith("ADMIN_MFA_CONFIGURATION") ? 503 : 401;
    return NextResponse.json(
      { error: status === 503 ? "MFA configuration unavailable" : "MFA challenge expired or invalid" },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
