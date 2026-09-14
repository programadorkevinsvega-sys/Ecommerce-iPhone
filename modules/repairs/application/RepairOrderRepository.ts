import type { RepairOrder, RepairOrderStatus } from "../domain/RepairOrder";
export type RepairOrderListQuery = Readonly<{ status?: RepairOrderStatus; customerId?: string; technicianId?: string; limit?: number }>;
export interface RepairOrderRepository { save(order: RepairOrder, actorId: string | null): Promise<void>; findById(id: string): Promise<RepairOrder | null>; findByServiceRequestId(serviceRequestId: string): Promise<RepairOrder | null>; findByPublicToken(token: string): Promise<RepairOrder | null>; list(query: RepairOrderListQuery): Promise<readonly RepairOrder[]>; }
