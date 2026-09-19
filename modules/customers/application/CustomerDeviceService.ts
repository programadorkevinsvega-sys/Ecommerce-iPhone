import type { CustomerDeviceRepository } from "./CustomerDeviceRepository";
import { CustomerDevice, type CustomerDeviceProps } from "../domain/CustomerDevice";

export class CustomerDeviceService {
  constructor(private readonly repository: CustomerDeviceRepository) {}

  async list(customerId: string): Promise<readonly CustomerDevice[]> {
    return this.repository.list(customerId);
  }

  async get(customerId: string, id: string): Promise<CustomerDevice | null> {
    return this.repository.find(customerId, id);
  }

  async create(customerId: string, input: Omit<CustomerDeviceProps, "customerId">): Promise<CustomerDevice> {
    const device = CustomerDevice.create(crypto.randomUUID(), { customerId, ...input });
    const created = await this.repository.create(device);
    await this.repository.recordEvent(customerId, created.getId(), "CREATED", { deviceType: input.deviceType });
    return created;
  }

  async update(customerId: string, id: string, input: Omit<CustomerDeviceProps, "customerId">): Promise<CustomerDevice | null> {
    const current = await this.repository.find(customerId, id);
    if (!current) return null;
    const next = CustomerDevice.create(id, { customerId, ...input });
    const updated = await this.repository.update(customerId, id, next.toPrimitives());
    if (updated) await this.repository.recordEvent(customerId, id, "UPDATED");
    return updated;
  }

  async archive(customerId: string, id: string): Promise<boolean> {
    const archived = await this.repository.archive(customerId, id);
    if (archived) await this.repository.recordEvent(customerId, id, "ARCHIVED");
    return archived;
  }
}
