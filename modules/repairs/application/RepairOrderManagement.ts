import { DomainError } from "../../shared-kernel";
import type { RepairOrderStatus } from "../domain/RepairOrder";
import type { RepairOrderRepository } from "./RepairOrderRepository";
export class RepairOrderManagement { constructor(private readonly orders: RepairOrderRepository) {} async transition(id: string, status: RepairOrderStatus, actorId: string) { const order = await this.orders.findById(id.trim()); if (!order) throw new DomainError("REPAIR_ORDER_NOT_FOUND"); order.transitionTo(status); await this.orders.save(order, actorId); return order; } }
