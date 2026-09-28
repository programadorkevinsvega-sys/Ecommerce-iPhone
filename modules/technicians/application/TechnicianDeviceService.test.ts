import { describe, expect, it, vi } from "vitest";
import { CustomerDevice } from "../../customers/domain/CustomerDevice";
import { RepairOrder } from "../../repairs/domain/RepairOrder";
import type { CustomerDeviceRepository } from "../../customers/application/CustomerDeviceRepository";
import type { RepairOrderRepository } from "../../repairs/application/RepairOrderRepository";
import type { TechnicianRepository } from "./TechnicianRepository";
import { TechnicianDeviceService } from "./TechnicianDeviceService";

function order(assignedTechnicianId = "tech-1") {
  return RepairOrder.create({
    id: "order-1",
    orderNumber: "REP-2026-ABC12345",
    customerId: "customer-1",
    email: "customer@example.com",
    status: "RECEIVED",
    problemReported: "La pantalla no enciende.",
    assignedTechnicianId,
    receivedAt: "2026-09-20T00:00:00.000Z",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    device: {
      id: "repair-device-1",
      brand: "Apple",
      model: "iPhone 15 Pro",
      conditions: [],
    },
  });
}

function setup() {
  const repairOrder = order();
  const devices = new Map<string, CustomerDevice>();
  const orders = new Map<string, RepairOrder>([[repairOrder.toPrimitives().id, repairOrder]]);
  const deviceRepository = {
    list: vi.fn(async () => [...devices.values()]),
    find: vi.fn(async (_customerId: string, id: string) => devices.get(id) ?? null),
    create: vi.fn(async (device: CustomerDevice) => {
      devices.set(device.getId(), device);
      return device;
    }),
    update: vi.fn(async (_customerId: string, id: string, props: ReturnType<CustomerDevice["toPrimitives"]>) => {
      const next = CustomerDevice.create(id, props);
      devices.set(id, next);
      return next;
    }),
    archive: vi.fn(async () => true),
    recordEvent: vi.fn(async () => undefined),
  } as unknown as CustomerDeviceRepository;

  const orderRepository = {
    save: vi.fn(async (next: RepairOrder) => orders.set(next.toPrimitives().id, next)),
    findById: vi.fn(async (id: string) => orders.get(id) ?? null),
    findByServiceRequestId: vi.fn(async () => null),
    findByPublicToken: vi.fn(async () => null),
    list: vi.fn(async ({ technicianId }: { technicianId?: string }) =>
      technicianId === "tech-1" ? [...orders.values()] : [],
    ),
  } as unknown as RepairOrderRepository;

  const technicians = {
    audit: vi.fn().mockResolvedValue(undefined),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
    recordFailedLogin: vi.fn(),
    recordSuccessfulLogin: vi.fn(),
  } as unknown as TechnicianRepository;

  return { repairOrder, devices, orders, deviceRepository, orderRepository, technicians, service: new TechnicianDeviceService(deviceRepository, orderRepository, technicians) };
}

describe("TechnicianDeviceService", () => {
  const input = {
    deviceType: "PHONE",
    brand: "Apple",
    model: "iPhone 15 Pro",
    serialLast4: "A1B2",
    imeiLast4: "1234",
    color: "Titanio natural",
    capacity: "256 GB",
    physicalCondition: "Marco con rayones",
    notes: "Equipo recibido apagado.",
  };

  it("registers the received device and links it to the assigned order", async () => {
    const context = setup();
    const device = await context.service.create("tech-1", "order-1", input);
    const savedOrder = context.orders.get("order-1")!;

    expect(device.toPrimitives()).toMatchObject(input);
    expect(savedOrder.toPrimitives().customerDeviceId).toBe(device.getId());
    expect(context.technicians.audit).toHaveBeenCalledWith(
      "tech-1",
      "DEVICE_CREATED",
      "customer_device",
      device.getId(),
      { orderId: "order-1", customerId: "customer-1" },
    );
  });

  it("prevents a technician from touching another technician's order", async () => {
    const context = setup();

    await expect(context.service.create("tech-2", "order-1", input)).rejects.toThrow("FORBIDDEN");
    expect(context.devices.size).toBe(0);
  });

  it("updates only the device linked to the assigned order", async () => {
    const context = setup();
    const device = await context.service.create("tech-1", "order-1", input);

    const updated = await context.service.update("tech-1", "order-1", { color: "Negro" });

    expect(updated.toPrimitives()).toMatchObject({ id: device.getId(), color: "Negro" });
    expect(context.technicians.audit).toHaveBeenLastCalledWith(
      "tech-1",
      "DEVICE_UPDATED",
      "customer_device",
      device.getId(),
      { orderId: "order-1" },
    );
  });
});
