import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminCustomerManagement } from "../../../../modules/customers/application/AdminCustomerManagement";
import { D1AdminCustomerRepository } from "../../../../modules/customers/infrastructure/D1AdminCustomerRepository";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

function application() {
  const { env } = getCloudflareContext();
  return new AdminCustomerManagement(new D1AdminCustomerRepository(env.DB));
}

export async function listAdminCustomers(query: unknown) {
  await requireAdmin(PERMISSIONS.customersRead);
  return application().list(query);
}

export async function updateAdminCustomer(id: string, body: Record<string, unknown>) {
  await requireAdmin(PERMISSIONS.customersWrite);
  await application().update(id, body);
}

export async function deleteAdminCustomer(id: string) {
  await requireAdmin(PERMISSIONS.customersWrite);
  await application().delete(id);
}
