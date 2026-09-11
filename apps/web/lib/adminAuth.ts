import { cookies, headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1AdminRepository } from "../../../modules/admin/infrastructure/D1AdminRepository";
import { AdminUser } from "../../../modules/admin/domain/AdminUser";
import type { AdminRole } from "../../../modules/admin/application/Rbac";
import { hasPermission, sha256, hashPassword, PERMISSIONS, type AdminPrincipal } from "../../../modules/admin/infrastructure/AdminSecurity";

export { PERMISSIONS };
export const ADMIN_COOKIE = "admin_session";
const SESSION_DAYS = 8;
const ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES", "SUPPORT", "INVENTORY", "FINANCE", "CONTENT_EDITOR", "TECHNICIAN"];

export async function adminRepository() { const { env } = getCloudflareContext(); return { env, repo: new D1AdminRepository(env.DB) }; }

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

export async function requestFingerprint() { const h = await headers(); const ip = h.get("CF-Connecting-IP") ?? h.get("X-Forwarded-For") ?? "unknown"; const userAgent = h.get("User-Agent") ?? "unknown"; return { ipHash: await sha256(ip), userAgentHash: await sha256(userAgent) }; }
export async function setAdminSession(token: string, expires: Date) { (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", expires }); }
export async function clearAdminSession() { (await cookies()).set(ADMIN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", expires: new Date(0) }); }
export function sessionExpiry() { return new Date(Date.now() + SESSION_DAYS * 86_400_000); }
export function newSessionToken() { return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""); }

export async function bootstrapAdmin(body: Record<string, unknown>, suppliedToken: string | null) {
  const { env, repo } = await adminRepository();
  const expected = (env as CloudflareEnv & { ADMIN_BOOTSTRAP_TOKEN?: string }).ADMIN_BOOTSTRAP_TOKEN;
  if (!expected || !suppliedToken || suppliedToken !== expected) throw new Error("NOT_FOUND");
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const role = String(body.role ?? "SUPER_ADMIN") as AdminRole;
  if (!email || !password || !firstName || !lastName) throw new Error("INVALID_ADMIN_DATA");
  if (!ROLES.includes(role)) throw new Error("INVALID_ROLE");
  if (await repo.findByEmail(email)) throw new Error("ADMIN_ALREADY_EXISTS");
  const user = AdminUser.create(crypto.randomUUID(), { email, passwordHash: await hashPassword(password), role, firstName, lastName, active: true, failedLoginCount: 0 });
  await repo.saveUser(user);
  await repo.audit(user.getId(), "ADMIN_BOOTSTRAPPED", "admin_user", user.getId(), { role, email });
  return user.getId();
}
