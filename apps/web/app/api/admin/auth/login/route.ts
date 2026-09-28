import { NextResponse } from "next/server";
import { cloudflareEnv } from "../../../../../lib/cloudflareContext";
import { buildAuthenticateAdmin } from "../../../../../lib/adminAuthCompositionV2";
import { requestFingerprint, setAdminSession } from "../../../../../lib/adminAuth";
import { validateEmail } from "../../../../../lib/inputValidation";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = validateEmail(String(body.email ?? ""));
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || password.length > 1024) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });

    const fingerprint = await requestFingerprint();
    const { env } = getCloudflareContext();
    const result = await buildAuthenticateAdmin(env).execute(email, password, fingerprint.ipHash, fingerprint.userAgentHash);
    await setAdminSession(result.token, result.expiresAt);

    return NextResponse.json({ admin: result.admin });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "ACCOUNT_LOCKED" ? 423 : code === "INVALID_CREDENTIALS" ? 401 : 400;
    return NextResponse.json(
      { error: status === 423 ? "Account temporarily locked" : status === 401 ? "Invalid credentials" : "Invalid login data" },
      { status },
    );
  }
}
