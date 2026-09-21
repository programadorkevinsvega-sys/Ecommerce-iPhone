import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PERMISSIONS } from "../../../../modules/admin/application/Rbac";
import { adminPermissionManagementApplication } from "../adminApplication";
import { requireAdmin } from "../adminAuth";

export async function getAdminUserPermissions(targetId: string) {
  const { admin, env } = await requireAdmin(PERMISSIONS.adminsManage);
  return adminPermissionManagementApplication(env).get(targetId, admin.id);
}

export async function updateAdminUserPermissions(
  targetId: string,
  overrides: unknown,
) {
  const { admin, env } = await requireAdmin(PERMISSIONS.adminsManage);
  return adminPermissionManagementApplication(env).update(targetId, overrides, admin.id);
}

export async function getAdminPermissionCatalog(role: string) {
  const { env } = await requireAdmin(PERMISSIONS.adminsManage);
  return adminPermissionManagementApplication(env).catalogForRole(role);
}
