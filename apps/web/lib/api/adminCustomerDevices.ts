import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminCustomerDeviceService } from "../../../../modules/customers/application/AdminCustomerDeviceService";
import { D1AdminCustomerDeviceRepository } from "../../../../modules/customers/infrastructure/D1AdminCustomerDeviceRepository";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

function application() {
  const { env } = getCloudflareContext();
  return new AdminCustomerDeviceService(new D1AdminCustomerDeviceRepository(env.DB));
}

export async function listAdminCustomerDevices(query: unknown) {
  await requireAdmin(PERMISSIONS.customersRead);
  return application().list(query);
}

export async function createAdminCustomerDevice(input: Record<string, unknown>) {
  await requireAdmin(PERMISSIONS.customersWrite);
  return application().create(parseInput(input));
}

export async function updateAdminCustomerDevice(id: string, input: Record<string, unknown>) {
  await requireAdmin(PERMISSIONS.customersWrite);
  return application().update(id, parseInput(input));
}

export async function archiveAdminCustomerDevice(id: string) {
  await requireAdmin(PERMISSIONS.customersWrite);
  return application().archive(id);
}

function parseInput(body: Record<string, unknown>) {
  const text = (key: string, max: number) => {
    const v = String(body[key] ?? "").replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
    return v || null;
  };
  const customerId = String(body.customerId ?? "").trim();
  const brand = text("brand", 60);
  const model = text("model", 100);
  if (!customerId || !brand || !model) throw new Error("INVALID_DEVICE");
  return { customerId, deviceType: String(body.deviceType ?? "PHONE").trim().toUpperCase(), brand, model, serialLast4: text("serialLast4", 4), imeiLast4: text("imeiLast4", 4), color: text("color", 60), capacity: text("capacity", 40), physicalCondition: text("physicalCondition", 1000), notes: text("notes", 1000) };
}
