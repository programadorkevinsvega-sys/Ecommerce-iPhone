import { NextResponse } from "next/server";
import { adminRepository, newSessionToken, requestFingerprint, setAdminSession, sessionExpiry } from "../../../../../lib/adminAuth";
import { sha256, verifyPassword } from "../../../../../../modules/admin/infrastructure/AdminSecurity";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    const { repo } = await adminRepository();
    const user = await repo.findByEmail(email);
    const fingerprint = await requestFingerprint();
    if (!user) {
      await repo.audit(null, "ADMIN_LOGIN_FAILED", "admin_user", null, { reason: "invalid_credentials", email }, fingerprint.ipHash);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const p = user.toPrimitives();
    if (p.lockedUntil && new Date(p.lockedUntil).getTime() > Date.now()) return NextResponse.json({ error: "Account temporarily locked" }, { status: 423 });
    if (!(await verifyPassword(password, p.passwordHash))) {
      user.recordFailedLogin();
      await repo.saveUser(user);
      await repo.audit(p.id, "ADMIN_LOGIN_FAILED", "admin_user", p.id, { reason: "invalid_credentials" }, fingerprint.ipHash);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    user.recordSuccessfulLogin();
    await repo.saveUser(user);
    await repo.revokeAllSessions(p.id);
    const token = newSessionToken();
    const expires = sessionExpiry();
    await repo.createSession(p.id, await sha256(token), expires.toISOString(), fingerprint.ipHash, fingerprint.userAgentHash);
    await repo.audit(p.id, "ADMIN_LOGIN_SUCCESS", "admin_user", p.id, { role: p.role }, fingerprint.ipHash);
    await setAdminSession(token, expires);
    return NextResponse.json({ admin: { id: p.id, email: p.email, role: p.role, firstName: p.firstName, lastName: p.lastName } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to login" }, { status: 500 }); }
}
