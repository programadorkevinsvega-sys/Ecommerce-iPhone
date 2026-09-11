import { AdminUser } from "../../../../modules/admin/domain/AdminUser";
import type { AdminRole } from "../../../../modules/admin/application/Rbac";
import { AdminManagementHardening } from "../../../../modules/admin/application/AdminManagementHardening";
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
  const user = await repo.findById(id);
  if (!user) throw new Error("ADMIN_NOT_FOUND");
  const current = user.toPrimitives();
  const role = body.role === undefined ? current.role : String(body.role) as AdminRole;
  if (!ROLES.includes(role)) throw new Error("INVALID_ROLE");
  const active = body.active === undefined ? current.active : body.active === true;
  if (id === admin.id && !active) throw new Error("SELF_DEACTIVATION_FORBIDDEN");
  if (id === admin.id && role !== admin.role) throw new Error("ADMIN_SELF_ROLE_CHANGE_FORBIDDEN");
  if (current.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && (await repo.countActiveSuperAdmins()) <= 1) throw new Error("LAST_SUPER_ADMIN_PROTECTED");
  const password = typeof body.password === "string" && body.password.length > 0 ? await hashPassword(body.password) : current.passwordHash;
  const next = AdminUser.create(current.id, { ...current, role, active, passwordHash: password });
  await repo.saveUser(next);
  if (password !== current.passwordHash || role !== current.role || active !== current.active) await repo.revokeAllSessions(id);
  await repo.audit(admin.id, "ADMIN_USER_UPDATED", "admin_user", id, { fields: Object.keys(body).filter((field) => field !== "password") });
}

export async function hardenAdminLifecycle(body: Record<string, unknown>) {
  const { admin, repo } = await requireAdmin(PERMISSIONS.adminsManage);
  const actor = await repo.findById(admin.id);
  if (!actor) throw new Error("ADMIN_NOT_FOUND");
  const targetId = String(body.id ?? "").trim();
  if (!targetId) throw new Error("ID_REQUIRED");
  const hardening = new AdminManagementHardening(repo);
  if (body.action === "activate") return hardening.activate(actor, targetId);
  if (body.action === "deactivate") return hardening.deactivate(actor, targetId);
  if (body.action === "change_role") {
    const role = String(body.role ?? "") as AdminRole;
    if (!ROLES.includes(role)) throw new Error("INVALID_ROLE");
    return hardening.changeRole(actor, targetId, role);
  }
  throw new Error("INVALID_ADMIN_ACTION");
}
