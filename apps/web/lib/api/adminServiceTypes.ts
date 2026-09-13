import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminServiceTypesApplication } from "../adminApplication";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function listAdminServiceTypes() {
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).list();
}

export async function createAdminServiceType(body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).create(body, admin.id);
}
