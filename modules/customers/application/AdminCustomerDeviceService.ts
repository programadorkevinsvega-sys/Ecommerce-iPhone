import { CustomerDevice, type CustomerDeviceProps } from "../domain/CustomerDevice";
import type { AdminCustomerDevice, AdminCustomerDeviceRepository } from "./AdminCustomerDeviceRepository";

export class AdminCustomerDeviceService {
  constructor(private readonly repository: AdminCustomerDeviceRepository) {}

  async list(query: unknown): Promise<readonly AdminCustomerDevice[]> {
    const normalized = String(query ?? "").replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 100);
    return this.repository.list(normalized);
  }

  async create(input: CustomerDeviceProps): Promise<CustomerDevice> {
    const device = CustomerDevice.create(crypto.randomUUID(), input);
    const created = await this.repository.create(device);
    await this.repository.recordEvent(input.customerId, created.getId(), "CREATED", { source: "ADMIN" });
    return created;
  }

  async update(id: string, input: CustomerDeviceProps): Promise<CustomerDevice | null> {
    const current = await this.repository.find(id);
    if (!current) return null;
    if (current.getCustomerId() !== input.customerId) throw new Error("DEVICE_CUSTOMER_IMMUTABLE");
    const next = CustomerDevice.create(id, input);
    const updated = await this.repository.update(id, next.toPrimitives());
    if (updated) await this.repository.recordEvent(input.customerId, id, "UPDATED", { source: "ADMIN" });
    return updated;
  }

  async archive(id: string): Promise<boolean> {
    const current = await this.repository.find(id);
    if (!current) return false;
    const archived = await this.repository.archive(id);
    if (archived) await this.repository.recordEvent(current.getCustomerId(), id, "ARCHIVED", { source: "ADMIN" });
    return archived;
  }
}
