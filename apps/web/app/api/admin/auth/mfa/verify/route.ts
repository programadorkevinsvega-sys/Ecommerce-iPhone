import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cloudflareEnv } from "../../../../../../lib/cloudflareContext";
import {
  ADMIN_MFA_CHALLENGE_COOKIE,
  clearAdminMfaChallenge,
  setAdminSession,
} from "../../../../../../lib/adminAuth";
import { requestFingerprint } from "../../../../../../lib/adminAuth";
import { completeAdminMfaLogin } from "../../../../../../lib/adminMfa";

export async function POST(request: Request) {
  try {
    const token = (await cookies()).get(ADMIN_MFA_CHALLENGE_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "MFA challenge required" }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code || code.length > 40) return NextResponse.json({ error: "Invalid MFA code" }, { status: 422 });
    const fingerprint = await requestFingerprint();
    const result = await completeAdminMfaLogin(cloudflareEnv(), {
      challengeToken: token,
      code,
      ipHash: fingerprint.ipHash,
      userAgentHash: fingerprint.userAgentHash,
    });
    await setAdminSession(result.token, result.expiresAt);
    await clearAdminMfaChallenge();
    return NextResponse.json(
      { admin: result.admin, ...(result.recoveryCodes ? { recoveryCodes: result.recoveryCodes } : {}) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "ACCOUNT_LOCKED" ? 423 :
      code === "INVALID_MFA_CODE" || code === "MFA_CHALLENGE_INVALID" || code === "MFA_CODE_REUSED" ? 401 :
      code.startsWith("ADMIN_MFA_CONFIGURATION") ? 503 : 400;
    const message =
      status === 423 ? "La cuenta está temporalmente bloqueada." :
      status === 503 ? "La configuración de MFA no está disponible. Contacta al operador." :
      "El código no es válido o el desafío ha expirado.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
