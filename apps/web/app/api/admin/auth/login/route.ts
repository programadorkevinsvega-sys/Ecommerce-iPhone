import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildAuthenticateAdmin } from "../../../../../lib/adminAuthComposition";
import { requestFingerprint, setAdminSession } from "../../../../../lib/adminAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    if (!email.trim() || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

    const fingerprint = await requestFingerprint();
    const { env } = getCloudflareContext();
    const result = await buildAuthenticateAdmin(env).execute(email, password, fingerprint.ipHash, fingerprint.userAgentHash);
    await setAdminSession(result.token, result.expiresAt);

    return NextResponse.json({ admin: result.admin });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "ACCOUNT_LOCKED" ? 423 : code === "INVALID_CREDENTIALS" ? 401 : 500;
    return NextResponse.json(
      { error: status === 423 ? "Account temporarily locked" : status === 401 ? "Invalid credentials" : "Unable to login" },
      { status },
    );
  }
}
