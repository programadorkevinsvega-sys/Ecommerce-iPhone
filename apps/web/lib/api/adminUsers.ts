import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminUserManagementApplication } from "../adminApplication";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function listAdminUsers() {
  await requireAdmin(PERMISSIONS.adminsManage);
  const { env } = getCloudflareContext();
  return adminUserManagementApplication(env).list();
}

export async function createAdminUser(body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.adminsManage);
  const { env } = getCloudflareContext();
  return adminUserManagementApplication(env).create(body, admin.id);
}

export async function updateAdminUser(body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.adminsManage);
  const { env } = getCloudflareContext();
  return adminUserManagementApplication(env).update(body, admin.id);
}

export async function hardenAdminLifecycle(body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.adminsManage);
  const { env } = getCloudflareContext();
  const management = adminUserManagementApplication(env);
  const targetId = String(body.id ?? "").trim();
  if (!targetId) throw new Error("ID_REQUIRED");

  if (body.action === "activate") return management.activate(targetId, admin.id);
  if (body.action === "deactivate") return management.deactivate(targetId, admin.id);
  if (body.action === "change_role") return management.changeRole(targetId, body.role, admin.id);
  if (body.action === "reset_password") return management.resetPassword(targetId, String(body.password ?? ""), admin.id);
  throw new Error("INVALID_ADMIN_ACTION");
}
