import { DomainError } from "../../shared-kernel";
import type { DeviceCondition, RepairOrderStatus } from "../domain/RepairOrder";
import type { RepairOrderRepository } from "./RepairOrderRepository";

const TECHNICIAN_STATUSES = [
  "DIAGNOSING",
  "WAITING_PART",
  "IN_REPAIR",
  "QUALITY_CONTROL",
] as const;

const DEVICE_CONDITIONS = [
  "FUNCTIONAL",
  "NOT_FUNCTIONAL",
  "DAMAGED",
  "NOT_TESTED",
  "NOT_APPLICABLE",
] as const;

const isTechnicianStatus = (value: string): value is (typeof TECHNICIAN_STATUSES)[number] =>
  TECHNICIAN_STATUSES.includes(value as (typeof TECHNICIAN_STATUSES)[number]);

const isDeviceCondition = (value: string): value is DeviceCondition =>
  DEVICE_CONDITIONS.includes(value as DeviceCondition);

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

  async transitionAssigned(id: string, statusInput: string, technicianId: string) {
    if (!isTechnicianStatus(statusInput)) {
      throw new DomainError("FORBIDDEN");
    }

    const order = await this.getAssigned(id, technicianId);
    order.transitionTo(statusInput);
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
      conditions: readonly { component: string; condition: string; notes?: string }[];
    },
    technicianId: string,
  ) {
    const conditions = input.conditions.map((item) => {
      const component = item.component.trim();
      if (!component || !isDeviceCondition(item.condition)) {
        throw new DomainError("INVALID_CONDITIONS");
      }
      return {
        component,
        condition: item.condition,
        ...(item.notes !== undefined ? { notes: item.notes } : {}),
      };
    });

    const order = await this.getAssigned(id, technicianId);
    order.updateTechnicalRecord({
      ...(input.diagnosisSummary !== undefined
        ? { diagnosisSummary: input.diagnosisSummary }
        : {}),
      ...(input.workSummary !== undefined
        ? { workSummary: input.workSummary }
        : {}),
      conditions,
    });
    await this.orders.save(order, technicianId);
    return order;
  }
}
