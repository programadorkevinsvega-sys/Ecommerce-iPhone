import { CustomerDeviceService } from "../../customers/application/CustomerDeviceService";
import type { CustomerDeviceRepository } from "../../customers/application/CustomerDeviceRepository";
import type { CustomerDeviceProps } from "../../customers/domain/CustomerDevice";
import type { RepairOrderRepository } from "../../repairs/application/RepairOrderRepository";
import type { TechnicianRepository } from "./TechnicianRepository";

type DeviceInput = Readonly<{
  deviceType?: unknown;
  brand?: unknown;
  model?: unknown;
  serialLast4?: unknown;
  imeiLast4?: unknown;
  color?: unknown;
  capacity?: unknown;
  physicalCondition?: unknown;
  notes?: unknown;
}>;

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export class TechnicianDeviceService {
  constructor(
    private readonly devices: CustomerDeviceRepository,
    private readonly orders: RepairOrderRepository,
    private readonly technicians: TechnicianRepository,
  ) {}

  async list(technicianId: string) {
    const orders = await this.orders.list({ technicianId, limit: 100 });
    const result = [];
    for (const order of orders) {
      const value = order.toPrimitives();
      if (!value.customerDeviceId || !value.customerId) continue;
      const device = await this.devices.find(value.customerId, value.customerDeviceId);
      if (device) {
        result.push({
          orderId: order.getId(),
          orderNumber: value.orderNumber,
          customerEmail: value.email,
          device: device.toPrimitives(),
        });
      }
    }
    return result;
  }

  private async assignedOrder(technicianId: string, orderId: string) {
    const order = await this.orders.findById(orderId);
    if (!order) throw new Error("REPAIR_ORDER_NOT_FOUND");
    const value = order.toPrimitives();
    if (value.assignedTechnicianId !== technicianId) throw new Error("FORBIDDEN");
    if (!value.customerId) throw new Error("REPAIR_ORDER_CUSTOMER_REQUIRED");
    return order;
  }

  private inputForCreate(input: DeviceInput): Omit<CustomerDeviceProps, "customerId"> {
    return {
      deviceType: typeof input.deviceType === "string" ? input.deviceType as CustomerDeviceProps["deviceType"] : "PHONE",
      brand: typeof input.brand === "string" ? input.brand : "",
      model: typeof input.model === "string" ? input.model : "",
      serialLast4: optionalText(input.serialLast4),
      imeiLast4: optionalText(input.imeiLast4),
      color: optionalText(input.color),
      capacity: optionalText(input.capacity),
      physicalCondition: optionalText(input.physicalCondition),
      notes: optionalText(input.notes),
    };
  }

  private inputForUpdate(
    input: DeviceInput,
    current: Omit<CustomerDeviceProps, "customerId">,
  ): Omit<CustomerDeviceProps, "customerId"> {
    return {
      deviceType: typeof input.deviceType === "string" ? input.deviceType as CustomerDeviceProps["deviceType"] : current.deviceType,
      brand: typeof input.brand === "string" ? input.brand : current.brand,
      model: typeof input.model === "string" ? input.model : current.model,
      serialLast4: input.serialLast4 === null ? null : typeof input.serialLast4 === "string" && input.serialLast4 ? input.serialLast4 : current.serialLast4,
      imeiLast4: input.imeiLast4 === null ? null : typeof input.imeiLast4 === "string" && input.imeiLast4 ? input.imeiLast4 : current.imeiLast4,
      color: input.color === null ? null : typeof input.color === "string" && input.color ? input.color : current.color,
      capacity: input.capacity === null ? null : typeof input.capacity === "string" && input.capacity ? input.capacity : current.capacity,
      physicalCondition: input.physicalCondition === null ? null : typeof input.physicalCondition === "string" && input.physicalCondition ? input.physicalCondition : current.physicalCondition,
      notes: input.notes === null ? null : typeof input.notes === "string" && input.notes ? input.notes : current.notes,
    };
  }

  async update(technicianId: string, orderId: string, input: DeviceInput) {
    const order = await this.assignedOrder(technicianId, orderId);
    const value = order.toPrimitives();
    if (!value.customerDeviceId || !value.customerId) throw new Error("DEVICE_NOT_LINKED");
    const current = await this.devices.find(value.customerId, value.customerDeviceId);
    if (!current) throw new Error("DEVICE_NOT_FOUND");

    const device = await new CustomerDeviceService(this.devices).update(
      value.customerId,
      value.customerDeviceId,
      this.inputForUpdate(input, current.toPrimitives()),
    );
    if (!device) throw new Error("DEVICE_NOT_FOUND");

    await this.technicians.audit(
      technicianId,
      "DEVICE_UPDATED",
      "customer_device",
      device.getId(),
      { orderId: order.getId() },
    );
    return device;
  }

  async create(technicianId: string, orderId: string, input: DeviceInput) {
    const order = await this.assignedOrder(technicianId, orderId);
    const value = order.toPrimitives();
    if (value.customerDeviceId) throw new Error("DEVICE_ALREADY_LINKED");

    const service = new CustomerDeviceService(this.devices);
    const device = await service.create(value.customerId!, this.inputForCreate(input));
    order.attachCustomerDevice(device.getId());
    await this.orders.save(order, technicianId);

    await this.technicians.audit(
      technicianId,
      "DEVICE_CREATED",
      "customer_device",
      device.getId(),
      { orderId: order.getId(), customerId: value.customerId },
    );
    return device;
  }
}
