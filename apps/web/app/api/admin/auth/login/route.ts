import { NextResponse } from "next/server";
import { cloudflareEnv } from "../../../../../lib/cloudflareContext";
import {
  requestFingerprint,
  setAdminMfaChallenge,
} from "../../../../../lib/adminAuth";
import { startAdminMfaLogin } from "../../../../../lib/adminMfa";
import { validateEmail } from "../../../../../lib/inputValidation";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = validateEmail(String(body.email ?? ""));
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || password.length > 1024) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }
    const fingerprint = await requestFingerprint();
    const challenge = await startAdminMfaLogin(cloudflareEnv(), {
      email,
      password,
      ipHash: fingerprint.ipHash,
      userAgentHash: fingerprint.userAgentHash,
    });
    await setAdminMfaChallenge(challenge.token, challenge.expiresAt);
    return NextResponse.json(
      { mfaRequired: true, enrollmentRequired: challenge.purpose === "enroll" },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "ACCOUNT_LOCKED" ? 423 :
      code === "INVALID_CREDENTIALS" ? 401 :
      code === "ADMIN_MFA_CONFIGURATION_REQUIRED" || code === "ADMIN_MFA_CONFIGURATION_INVALID" ? 503 :
      code === "MFA_ENROLLMENT_CONFLICT" ? 409 : 400;
    const message =
      status === 423 ? "Account temporarily locked" :
      status === 401 ? "Invalid credentials" :
      status === 503 ? "Multi-factor authentication is not configured. Contact the system operator." :
      status === 409 ? "MFA enrollment is already in progress. Start login again." :
      "Invalid login data";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
