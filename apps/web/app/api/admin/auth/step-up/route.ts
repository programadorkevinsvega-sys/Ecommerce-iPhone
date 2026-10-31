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
type AdminStepUpScope = "payments:refund" | "payments:void" | "admins:manage" | "settings:write";

const ALLOWED_SCOPES = new Set<AdminStepUpScope>([
  "payments:refund",
  "payments:void",
  "admins:manage",
  "settings:write",
]);

export async function POST(request: Request) {
  try {
    const admin = await currentAdmin();
    const sessionToken = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!admin || !sessionToken) {
      return NextResponse.json(
        { error: "Tu sesión ya no es válida. Inicia sesión nuevamente." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    const scope = typeof body.scope === "string" ? body.scope : "";
    if (!password || password.length > 128 || !ALLOWED_SCOPES.has(scope as AdminStepUpScope)) {
      return NextResponse.json({ error: "Datos de reautenticación no válidos." }, { status: 422 });
    }

    const requiredPermission: Record<AdminStepUpScope, Permission> = {
      "payments:refund": "refunds:create",
      "payments:void": "payments:void",
      "admins:manage": "admins:manage",
      "settings:write": "settings:write",
    };
    if (!admin.permissions.includes(requiredPermission[scope as AdminStepUpScope])) {
      return NextResponse.json(
        { error: "No tienes permiso para esta operación." },
        { status: 403 },
      );
    }

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
      code === "ACCOUNT_LOCKED"
        ? 423
        : code === "INVALID_CREDENTIALS"
          ? 401
          : code === "UNAUTHORIZED"
            ? 401
            : 400;
    const message =
      status === 423
        ? "La cuenta está temporalmente bloqueada."
        : status === 401
          ? "La contraseña no es correcta o la sesión expiró."
          : "No se pudo completar la reautenticación.";
    return NextResponse.json(
      { error: message },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
