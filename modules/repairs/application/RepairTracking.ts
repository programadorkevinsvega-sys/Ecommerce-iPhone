import type { RepairOrderRepository } from "./RepairOrderRepository";
import { DomainError } from "../../shared-kernel";

export class RepairTracking {
  constructor(private readonly orders: RepairOrderRepository) {}
  async lookup(orderNumber: string, token: string) {
    const order = await this.orders.findByPublicToken(token.trim());
    if (!order || order.toPrimitives().orderNumber !== orderNumber.trim().toUpperCase()) throw new DomainError("REPAIR_NOT_FOUND");
    const value = order.toPrimitives();
    return { orderNumber: value.orderNumber, status: value.status, problemReported: value.problemReported, receivedAt: value.receivedAt, device: { brand: value.device.brand, model: value.device.model, ...(value.device.color ? { color: value.device.color } : {}) }, timeline: [{ status: value.status, at: value.updatedAt }] };
  }
}
