import { DomainError } from "../../shared-kernel";
import type { ServiceRequestRepository } from "../../services/application/ServiceRequestRepository";
import type { RepairOrderRepository } from "./RepairOrderRepository";
import { RepairOrder } from "../domain/RepairOrder";

const orderNumber = () => `REP-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
export class CreateRepairOrder {
  constructor(private readonly requests: ServiceRequestRepository, private readonly orders: RepairOrderRepository) {}
  async execute(serviceRequestId: string, actorId: string): Promise<RepairOrder> {
    const requestId = serviceRequestId.trim();
    if (!requestId || !actorId.trim()) throw new DomainError("INVALID_REPAIR_INPUT");
    if (await this.orders.findByServiceRequestId(requestId)) throw new DomainError("REPAIR_ORDER_ALREADY_EXISTS");
    const request = await this.requests.findById(requestId);
    if (!request) throw new DomainError("SERVICE_REQUEST_NOT_FOUND");
    const source = request.toPrimitives();
    if (source.type !== "REPAIR") throw new DomainError("SERVICE_REQUEST_NOT_REPAIR");
    const now = new Date().toISOString();
    const order = RepairOrder.create({ id: crypto.randomUUID(), orderNumber: orderNumber(), serviceRequestId: requestId, ...(source.customerId ? { customerId: source.customerId } : {}), email: source.email, status: "RECEIVED", problemReported: source.problemDescription, ...(source.assignedTechnicianId ? { assignedTechnicianId: source.assignedTechnicianId } : {}), receivedAt: now, createdAt: now, updatedAt: now, device: { id: crypto.randomUUID(), brand: source.deviceBrand, model: source.deviceModel, ...(source.deviceSerialLast4 ? { serialLast4: source.deviceSerialLast4 } : {}), ...(source.imeiLast4 ? { imeiLast4: source.imeiLast4 } : {}), conditions: [] } });
    await this.orders.save(order, actorId);
    return order;
  }
}
