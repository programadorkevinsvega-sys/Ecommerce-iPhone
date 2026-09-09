import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminRepository, clearAdminSession, currentAdmin, requestFingerprint } from "../../../../../lib/adminAuth";
import { sha256 } from "../../../../../../modules/admin/infrastructure/AdminSecurity";

export async function GET() { const admin = await currentAdmin(); return NextResponse.json({ authenticated: Boolean(admin), admin }); }

export async function DELETE() {
  const value = (await cookies()).get("admin_session")?.value;
  const admin = await currentAdmin();
  if (value && admin) {
    const { repo } = await adminRepository();
    const fingerprint = await requestFingerprint();
    const found = await repo.findSession(await sha256(value));
    if (found) await repo.revokeSession(found.sessionId);
    await repo.audit(admin.id, "ADMIN_LOGOUT", "admin_user", admin.id, {}, fingerprint.ipHash);
  }
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
