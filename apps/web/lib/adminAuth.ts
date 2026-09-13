import { cookies, headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PERMISSIONS } from "../../../modules/admin/application/Rbac";
import type { AdminPrincipal } from "../../../modules/admin/application/AuthenticateAdmin";
import { buildRequestFingerprint } from "./adminFingerprintComposition";
import { buildBootstrapAdmin, buildLogoutAdmin, buildRequireAdmin } from "./adminAuthComposition";

export { PERMISSIONS };
export const ADMIN_COOKIE = "admin_session";

export async function currentAdmin(): Promise<AdminPrincipal | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const { env } = getCloudflareContext();
  return buildRequireAdmin(env).execute(token).catch((error: unknown) => {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return null;
    throw error;
  });
}

export async function requireAdmin(permission?: string): Promise<{ admin: AdminPrincipal; env: CloudflareEnv }> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const { env } = getCloudflareContext();
  const admin = await buildRequireAdmin(env).execute(token, permission);
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

export async function clearAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
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
  const expected = (env as CloudflareEnv & { ADMIN_BOOTSTRAP_TOKEN?: string }).ADMIN_BOOTSTRAP_TOKEN;
  return buildBootstrapAdmin(env).execute(body, suppliedToken, expected);
}
