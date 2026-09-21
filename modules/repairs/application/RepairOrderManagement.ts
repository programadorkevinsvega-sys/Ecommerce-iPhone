import { DomainError } from "../../shared-kernel";
import type { RepairOrderStatus, DeviceCondition } from "../domain/RepairOrder";
import type { RepairOrderRepository } from "./RepairOrderRepository";

export class RepairOrderManagement {
  constructor(private readonly orders: RepairOrderRepository) {}

  async get(id: string) {
    const order = await this.orders.findById(id.trim());
    if (!order) throw new DomainError("REPAIR_ORDER_NOT_FOUND");
    return order;
  }

  async listAssigned(technicianId: string, limit = 100) {
    return this.orders.list({ technicianId, limit });
  }

  async getAssigned(id: string, technicianId: string) {
    const order = await this.get(id);
    if (order.toPrimitives().assignedTechnicianId !== technicianId) {
      throw new DomainError("FORBIDDEN");
    }
    return order;
  }

  async transition(id: string, status: RepairOrderStatus, actorId: string) {
    const order = await this.get(id);
    order.transitionTo(status);
    await this.orders.save(order, actorId);
    return order;
  }

  async transitionAssigned(id: string, status: RepairOrderStatus, technicianId: string) {
    const order = await this.getAssigned(id, technicianId);
    order.transitionTo(status);
    await this.orders.save(order, technicianId);
    return order;
  }

  async updateTechnicalRecord(
    id: string,
    input: {
      diagnosisSummary?: string | null;
      workSummary?: string | null;
      conditions: readonly { component: string; condition: DeviceCondition; notes?: string }[];
    },
    actorId: string,
  ) {
    const order = await this.get(id);
    order.updateTechnicalRecord(input);
    await this.orders.save(order, actorId);
    return order;
  }

  async updateTechnicalRecordAssigned(
    id: string,
    input: {
      diagnosisSummary?: string | null;
      workSummary?: string | null;
      conditions: readonly { component: string; condition: DeviceCondition; notes?: string }[];
    },
    technicianId: string,
  ) {
    const order = await this.getAssigned(id, technicianId);
    order.updateTechnicalRecord(input);
    await this.orders.save(order, technicianId);
    return order;
  }
}
