import { NextResponse } from "next/server";
import type { Permission } from "../../../../../../../modules/admin/application/Rbac";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  createAdminStepUp,
  currentAdmin,
  requestFingerprint,
  setAdminStepUp,
} from "../../../../../lib/adminAuth";
import { cloudflareEnv } from "../../../../../lib/cloudflareContext";
import { verifyAdminMfaFactor, verifyAdminPasswordForPrivilegedAction } from "../../../../../lib/adminMfa";

type AdminStepUpScope = "payments:refund" | "payments:void" | "admins:manage" | "settings:write";
const ALLOWED_SCOPES = new Set<AdminStepUpScope>([
  "payments:refund", "payments:void", "admins:manage", "settings:write",
]);

export async function POST(request: Request) {
  try {
    const admin = await currentAdmin();
    const sessionToken = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!admin || !sessionToken) {
      return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    const secondFactorCode = typeof body.secondFactorCode === "string" ? body.secondFactorCode.trim() : "";
    const scope = typeof body.scope === "string" ? body.scope : "";
    if (!password || password.length > 128 || !secondFactorCode || secondFactorCode.length > 40 || !ALLOWED_SCOPES.has(scope as AdminStepUpScope)) {
      return NextResponse.json({ error: "Datos de reautenticación no válidos." }, { status: 422 });
    }

    const requiredPermission: Record<AdminStepUpScope, Permission> = {
      "payments:refund": "refunds:create",
      "payments:void": "payments:void",
      "admins:manage": "admins:manage",
      "settings:write": "settings:write",
    };
    if (!admin.permissions.includes(requiredPermission[scope as AdminStepUpScope])) {
      return NextResponse.json({ error: "No tienes permiso para esta operación." }, { status: 403 });
    }

    const env = cloudflareEnv();
    await verifyAdminPasswordForPrivilegedAction(env, admin.id, password);
    await verifyAdminMfaFactor(env, admin.id, secondFactorCode);
    const fingerprint = await requestFingerprint();
    const grant = await createAdminStepUp({
      adminUserId: admin.id,
      sessionToken,
      password,
      scope: scope as AdminStepUpScope,
      ipHash: fingerprint.ipHash,
    });
    await setAdminStepUp(grant.token, grant.expiresAt);
    return NextResponse.json(
      { verified: true, expiresAt: grant.expiresAt.toISOString(), scope },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "ACCOUNT_LOCKED" ? 423 :
      code === "INVALID_CREDENTIALS" || code === "INVALID_MFA_CODE" || code === "MFA_CODE_REUSED" || code === "ADMIN_MFA_REQUIRED" ? 401 :
      code === "UNAUTHORIZED" ? 401 :
      code === "ADMIN_MFA_CONFIGURATION_REQUIRED" || code === "ADMIN_MFA_CONFIGURATION_INVALID" ? 503 : 400;
    const message =
      status === 423 ? "La cuenta está temporalmente bloqueada." :
      status === 401 ? "La contraseña, el segundo factor o la sesión no son válidos." :
      status === 503 ? "La configuración de MFA no está disponible. Contacta al operador." :
      "No se pudo completar la reautenticación.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
