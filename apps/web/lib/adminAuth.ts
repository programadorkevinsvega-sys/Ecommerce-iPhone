import { cookies, headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PERMISSIONS } from "../../../modules/admin/application/Rbac";
import type { AdminStepUpScope } from "../../../modules/admin/application/AdminStepUpRepository";
import type { CurrentAdmin } from "../../../modules/admin/application/ResolveCurrentAdmin";
import { D1AdminStepUpRepository } from "../../../modules/admin/infrastructure/D1AdminStepUpRepository";
import { sha256 } from "../../../modules/admin/infrastructure/AdminSecurity";
import { buildRequestFingerprint } from "./adminFingerprintComposition";
import { buildBootstrapAdmin, buildLogoutAdmin, buildRequireAdmin } from "./adminAuthCompositionV2";

export { PERMISSIONS };
export const ADMIN_COOKIE = "admin_session";
export const ADMIN_STEP_UP_COOKIE = "admin_step_up";

export async function currentAdmin(): Promise<CurrentAdmin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const { env } = getCloudflareContext();
  return buildRequireAdmin(env)
    .execute(token)
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "UNAUTHORIZED") return null;
      throw error;
    });
}

export async function requireAdmin(
  permission?: string,
): Promise<{ admin: CurrentAdmin; env: CloudflareEnv }> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const { env } = getCloudflareContext();
  const admin = await buildRequireAdmin(env).execute(token, permission);
  return { admin, env };
}

export async function requireAdminStepUp(
  permission: string,
  scope: AdminStepUpScope,
): Promise<{ admin: CurrentAdmin; env: CloudflareEnv }> {
  const store = await cookies();
  const sessionToken = store.get(ADMIN_COOKIE)?.value;
  const proofToken = store.get(ADMIN_STEP_UP_COOKIE)?.value;
  const { admin, env } = await requireAdmin(permission);
  if (!sessionToken || !proofToken) throw new Error("ADMIN_STEP_UP_REQUIRED");

  const valid = await new D1AdminStepUpRepository(env.DB).hasValid({
    adminUserId: admin.id,
    sessionTokenHash: await sha256(sessionToken),
    tokenHash: await sha256(proofToken),
    scope,
  });
  if (!valid) throw new Error("ADMIN_STEP_UP_REQUIRED");
  return { admin, env };
}

export async function requestFingerprint() {
  const h = await headers();
  const ip = h.get("CF-Connecting-IP") ?? h.get("X-Forwarded-For") ?? "unknown";
  const userAgent = h.get("User-Agent") ?? "unknown";
  return buildRequestFingerprint().execute(ip, userAgent);
}

export async function setAdminSession(token: string, expires: Date) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires,
  });
}

export async function setAdminStepUp(token: string, expires: Date) {
  (await cookies()).set(ADMIN_STEP_UP_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api/admin",
    expires,
    maxAge: 300,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
  store.set(ADMIN_STEP_UP_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api/admin",
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function logoutAdmin() {
  const admin = await currentAdmin();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (admin) {
    const fingerprint = await requestFingerprint();
    const { env } = getCloudflareContext();
    await buildLogoutAdmin(env).execute(admin.id, token, fingerprint.ipHash);
  }
  await clearAdminSession();
}

export async function bootstrapAdmin(body: Record<string, unknown>, suppliedToken: string | null) {
  const { env } = getCloudflareContext();
  const expected = (env as CloudflareEnv & { ADMIN_BOOTSTRAP_TOKEN?: string })
    .ADMIN_BOOTSTRAP_TOKEN;
  return buildBootstrapAdmin(env).execute(body, suppliedToken, expected);
}
