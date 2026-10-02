import { revalidateTag } from "next/cache";
import { CATEGORIES_CACHE_TAG } from "../../../../modules/catalog/application/Categories";
import { adminCategoriesApplication } from "../adminApplication";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function listAdminCategories(query?: string) {
  const { admin, env } = await requireAdmin(PERMISSIONS.categoriesRead);
  return adminCategoriesApplication(env).list({ actor: admin, query });
}

export async function getAdminCategory(id: string) {
  const { admin, env } = await requireAdmin(PERMISSIONS.categoriesRead);
  return adminCategoriesApplication(env).get({ actor: admin, id });
}

export async function createAdminCategory(body: unknown) {
  const { admin, env } = await requireAdmin(PERMISSIONS.categoriesWrite);
  const category = await adminCategoriesApplication(env).create({ actor: admin, body });
  revalidateTag(CATEGORIES_CACHE_TAG);
  return category;
}

export async function updateAdminCategory(id: string, body: unknown) {
  const { admin, env } = await requireAdmin(PERMISSIONS.categoriesWrite);
  const category = await adminCategoriesApplication(env).update({ actor: admin, id, body });
  revalidateTag(CATEGORIES_CACHE_TAG);
  return category;
}

export async function deactivateAdminCategory(id: string) {
  const { admin, env } = await requireAdmin(PERMISSIONS.categoriesWrite);
  await adminCategoriesApplication(env).deactivate({ actor: admin, id });
  revalidateTag(CATEGORIES_CACHE_TAG);
}

export async function activateAdminCategory(id: string) {
  const { admin, env } = await requireAdmin(PERMISSIONS.categoriesWrite);
  await adminCategoriesApplication(env).activate({ actor: admin, id });
  revalidateTag(CATEGORIES_CACHE_TAG);
}

export async function deleteAdminCategory(id: string) {
  const { admin, env } = await requireAdmin(PERMISSIONS.categoriesWrite);
  await adminCategoriesApplication(env).delete({ actor: admin, id });
  revalidateTag(CATEGORIES_CACHE_TAG);
}
