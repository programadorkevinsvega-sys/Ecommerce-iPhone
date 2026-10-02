import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminServiceTypesApplication } from "../adminApplication";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function listAdminServiceTypes() {
  await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).list();
}

export async function createAdminServiceType(body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).create(body, admin.id);
}

export async function updateAdminServiceType(code: string, body: Record<string, unknown>) {
  const { admin } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).update(code, body, admin.id);
}

export async function disableAdminServiceType(code: string) {
  const { admin } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).disable(code, admin.id);
}

export async function enableAdminServiceType(code: string) {
  const { admin } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).enable(code, admin.id);
}

export async function deleteAdminServiceType(code: string) {
  const { admin } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const { env } = getCloudflareContext();
  return adminServiceTypesApplication(env).delete(code, admin.id);
}
