import { cookies, headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1AdminRepository } from "../../../modules/admin/infrastructure/D1AdminRepository";
import { hasPermission, sha256, type AdminPrincipal } from "../../../modules/admin/infrastructure/AdminSecurity";

export const ADMIN_COOKIE = "admin_session";
const SESSION_DAYS = 8;

export async function adminRepository() {
  const { env } = getCloudflareContext();
  return { env, repo: new D1AdminRepository(env.DB) };
}

export async function currentAdmin(): Promise<AdminPrincipal | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const { repo } = await adminRepository();
  const found = await repo.findSession(await sha256(token));
  if (!found) return null;
  const p = found.user.toPrimitives();
  return { id: p.id, email: p.email, role: p.role, firstName: p.firstName, lastName: p.lastName };
}

export async function requireAdmin(permission?: string): Promise<{ admin: AdminPrincipal; repo: D1AdminRepository; env: CloudflareEnv }> {
  const { repo, env } = await adminRepository();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) throw new Error("UNAUTHORIZED");
  const found = await repo.findSession(await sha256(token));
  if (!found) throw new Error("UNAUTHORIZED");
  const p = found.user.toPrimitives();
  const admin = { id: p.id, email: p.email, role: p.role, firstName: p.firstName, lastName: p.lastName } satisfies AdminPrincipal;
  if (permission && !hasPermission(admin.role, permission)) throw new Error("FORBIDDEN");
  return { admin, repo, env };
}

export async function requestFingerprint() {
  const h = await headers();
  const ip = h.get("CF-Connecting-IP") ?? h.get("X-Forwarded-For") ?? "unknown";
  const userAgent = h.get("User-Agent") ?? "unknown";
  return { ipHash: await sha256(ip), userAgentHash: await sha256(userAgent) };
}

export async function setAdminSession(token: string, expires: Date) {
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", expires });
}

export async function clearAdminSession() { (await cookies()).set(ADMIN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", expires: new Date(0) }); }

export function sessionExpiry() { return new Date(Date.now() + SESSION_DAYS * 86_400_000); }
export function newSessionToken() { return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""); }
