import { NextResponse } from "next/server";
import { clearAdminSession, currentAdmin, adminRepository, requestFingerprint } from "../../../../../lib/adminAuth";

export async function GET() {
  const admin = await currentAdmin();
  return NextResponse.json({ authenticated: Boolean(admin), admin });
}

export async function DELETE() {
  const token = (await import("next/headers")).cookies().then(c => c.get("admin_session")?.value);
  const value = await token;
  const admin = await currentAdmin();
  if (value && admin) {
    const { repo } = await adminRepository();
    const fingerprint = await requestFingerprint();
    const { sha256 } = await import("../../../../../../modules/admin/infrastructure/AdminSecurity");
    const found = await repo.findSession(await sha256(value));
    if (found) await repo.revokeSession(found.sessionId);
    await repo.audit(admin.id, "ADMIN_LOGOUT", "admin_user", admin.id, {}, fingerprint.ipHash);
  }
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
