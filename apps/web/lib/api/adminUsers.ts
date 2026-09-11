import { AdminUser } from "../../../../modules/admin/domain/AdminUser";
import type { AdminRole } from "../../../../modules/admin/application/Rbac";
import { hashPassword } from "../../../../modules/admin/infrastructure/AdminSecurity";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

const ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES", "SUPPORT", "INVENTORY", "FINANCE", "CONTENT_EDITOR", "TECHNICIAN"];

export async function listAdminUsers() {
  const { env } = await requireAdmin(PERMISSIONS.adminsManage);
  const rows = await env.DB.prepare("SELECT id,email,role,first_name,last_name,active,failed_login_count,locked_until,last_login_at,created_at,updated_at FROM admin_users ORDER BY created_at DESC").all();
  return rows.results;
}

export async function createAdminUser(body: Record<string, unknown>) {
  const { admin, repo } = await requireAdmin(PERMISSIONS.adminsManage);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = String(body.role ?? "ADMIN") as AdminRole;
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  if (!email || !password || !firstName || !lastName || !ROLES.includes(role)) throw new Error("INVALID_ADMIN_DATA");
  if (await repo.findByEmail(email)) throw new Error("ADMIN_ALREADY_EXISTS");
  const user = AdminUser.create(crypto.randomUUID(), { email, passwordHash: await hashPassword(password), role, firstName, lastName, active: true, failedLoginCount: 0 });
  await repo.saveUser(user);
  await repo.audit(admin.id, "ADMIN_USER_CREATED", "admin_user", user.getId(), { email, role });
  return user.getId();
}

export async function updateAdminUser(body: Record<string, unknown>) {
  const { admin, repo } = await requireAdmin(PERMISSIONS.adminsManage);
  const id = String(body.id ?? "");
  if (!id) throw new Error("ID_REQUIRED");
  if (id === admin.id && body.active === false) throw new Error("SELF_DEACTIVATION_FORBIDDEN");
  const user = await repo.findById(id);
  if (!user) throw new Error("ADMIN_NOT_FOUND");
  const p = user.toPrimitives();
  const role = body.role === undefined ? p.role : String(body.role) as AdminRole;
  if (!ROLES.includes(role)) throw new Error("INVALID_ROLE");
  const active = body.active === undefined ? p.active : Boolean(body.active);
  const password = typeof body.password === "string" && body.password.length > 0 ? await hashPassword(body.password) : p.passwordHash;
  const next = AdminUser.create(p.id, { ...p, role, active, passwordHash: password });
  await repo.saveUser(next);
  if (password !== p.passwordHash) await repo.revokeAllSessions(id);
  await repo.audit(admin.id, "ADMIN_USER_UPDATED", "admin_user", id, { fields: Object.keys(body).filter((field) => field !== "password") });
}
