import { describe, expect, it } from "vitest";
import { CustomerDeviceService } from "./CustomerDeviceService";
import type { CustomerDeviceRepository } from "./CustomerDeviceRepository";
import { CustomerDevice, type CustomerDeviceProps } from "../domain/CustomerDevice";

class Devices implements CustomerDeviceRepository {
  private readonly items = new Map<string, CustomerDevice>();
  private readonly events: string[] = [];
  async list(customerId: string): Promise<readonly CustomerDevice[]> {
    return [...this.items.values()].filter(item => item.getCustomerId() === customerId);
  }
  async find(customerId: string, id: string): Promise<CustomerDevice | null> {
    const item = this.items.get(id);
    return item?.getCustomerId() === customerId ? item : null;
  }
  async create(device: CustomerDevice): Promise<CustomerDevice> {
    this.items.set(device.getId(), device);
    return device;
  }
  async update(customerId: string, id: string, props: CustomerDeviceProps): Promise<CustomerDevice | null> {
    if (!(await this.find(customerId, id))) return null;
    const device = (await import("../domain/CustomerDevice")).CustomerDevice.create(id, props);
    this.items.set(id, device);
    return device;
  }
  async archive(customerId: string, id: string): Promise<boolean> {
    return (await this.find(customerId, id)) !== null;
  }
  async recordEvent(_customerId: string, _deviceId: string, eventType: "CREATED" | "UPDATED" | "ARCHIVED"): Promise<void> {
    this.events.push(eventType);
  }
  eventTypes(): readonly string[] { return this.events; }
}

describe("CustomerDeviceService", () => {
  const input = {
    deviceType: "PHONE",
    brand: "Apple",
    model: "iPhone 15 Pro",
    serialLast4: "A1B2",
    imeiLast4: "1234",
    color: "Titanio natural",
    capacity: "256 GB",
    physicalCondition: "Marco con rayones",
    notes: "Cliente reporta caída.",
  };

  it("creates a device and records the creation event", async () => {
    const repository = new Devices();
    const device = await new CustomerDeviceService(repository).create("customer-1", input);
    expect(device.toPrimitives()).toMatchObject(input);
    expect(repository.eventTypes()).toEqual(["CREATED"]);
  });

  it("never allows another customer to update or archive the device", async () => {
    const repository = new Devices();
    const service = new CustomerDeviceService(repository);
    const device = await service.create("customer-1", input);
    expect(await service.update("customer-2", device.getId(), input)).toBeNull();
    expect(await service.archive("customer-2", device.getId())).toBe(false);
  });

  it("returns a device only to its owning customer", async () => {
    const repository = new Devices();
    const service = new CustomerDeviceService(repository);
    const device = await service.create("customer-1", input);
    expect(await service.get("customer-1", device.getId())).not.toBeNull();
    expect(await service.get("customer-2", device.getId())).toBeNull();
  });


  it("rejects invalid protected identifiers", async () => {
    const repository = new Devices();
    await expect(new CustomerDeviceService(repository).create("customer-1", { ...input, imeiLast4: "123" })).rejects.toThrow();
  });
});
