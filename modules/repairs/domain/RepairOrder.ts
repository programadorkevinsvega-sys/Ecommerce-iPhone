import { DomainError } from "../../shared-kernel";

export type RepairOrderStatus = "RECEIVED" | "DIAGNOSING" | "WAITING_APPROVAL" | "WAITING_PART" | "IN_REPAIR" | "QUALITY_CONTROL" | "READY" | "DELIVERED" | "CANCELLED";
export type DeviceCondition = "FUNCTIONAL" | "NOT_FUNCTIONAL" | "DAMAGED" | "NOT_TESTED" | "NOT_APPLICABLE";
export type RepairDeviceCondition = Readonly<{ component: string; condition: DeviceCondition; notes?: string }>;
export type RepairDeviceSheet = Readonly<{ id: string; brand: string; model: string; serialLast4?: string; imeiLast4?: string; color?: string; storageGb?: number; batteryHealth?: number; conditions: readonly RepairDeviceCondition[] }>;
export type RepairOrderProps = Readonly<{ id: string; orderNumber: string; publicToken?: string; serviceRequestId?: string; customerId?: string; email: string; status: RepairOrderStatus; problemReported: string; diagnosisSummary?: string; workSummary?: string; assignedTechnicianId?: string; receivedAt: string; estimatedCompletionAt?: string; deliveredAt?: string; createdAt: string; updatedAt: string; device: RepairDeviceSheet }>;

export const REPAIR_ORDER_TRANSITIONS: Record<RepairOrderStatus, readonly RepairOrderStatus[]> = {
  RECEIVED: ["DIAGNOSING", "CANCELLED"], DIAGNOSING: ["WAITING_APPROVAL", "WAITING_PART", "IN_REPAIR", "CANCELLED"], WAITING_APPROVAL: ["WAITING_PART", "IN_REPAIR", "CANCELLED"], WAITING_PART: ["IN_REPAIR", "CANCELLED"], IN_REPAIR: ["QUALITY_CONTROL", "WAITING_PART", "CANCELLED"], QUALITY_CONTROL: ["READY", "IN_REPAIR", "CANCELLED"], READY: ["DELIVERED", "CANCELLED"], DELIVERED: [], CANCELLED: [],
};

const required = (value: string, field: string, max: number) => { const normalized = value.trim(); if (!normalized || normalized.length > max) throw new DomainError(`Invalid repair ${field}`); return normalized; };
export function assertRepairOrderTransition(from: RepairOrderStatus, to: RepairOrderStatus): void { if (!REPAIR_ORDER_TRANSITIONS[from].includes(to)) throw new DomainError("INVALID_REPAIR_TRANSITION"); }

export class RepairOrder {
  private constructor(private props: RepairOrderProps) {}
  static create(props: RepairOrderProps): RepairOrder {
    if (!/^REP-[0-9]{4}-[A-Z0-9]{8,32}$/.test(props.orderNumber)) throw new DomainError("INVALID_REPAIR_ORDER_NUMBER");
    const publicToken = props.publicToken ?? crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    if (!/^[A-Za-z0-9]{24,128}$/.test(publicToken)) throw new DomainError("INVALID_REPAIR_PUBLIC_TOKEN");
    if (!props.email.includes("@")) throw new DomainError("INVALID_REPAIR_EMAIL");
    if (!props.problemReported.trim()) throw new DomainError("INVALID_REPAIR_PROBLEM");
    if (props.device.batteryHealth !== undefined && (props.device.batteryHealth < 0 || props.device.batteryHealth > 100)) throw new DomainError("INVALID_BATTERY_HEALTH");
    const device = { ...props.device, brand: required(props.device.brand, "device brand", 80), model: required(props.device.model, "device model", 120), conditions: props.device.conditions.map((item) => ({ component: required(item.component, "condition component", 80), condition: item.condition, ...(item.notes?.trim() ? { notes: item.notes.trim().slice(0, 500) } : {}) })) };
    return new RepairOrder({ ...props, publicToken, problemReported: props.problemReported.trim().slice(0, 5000), device });
  }
  transitionTo(status: RepairOrderStatus): void { if (status !== this.props.status) assertRepairOrderTransition(this.props.status, status); const deliveredAt = status === "DELIVERED" ? new Date().toISOString() : this.props.deliveredAt; this.props = { ...this.props, status, updatedAt: new Date().toISOString(), ...(deliveredAt ? { deliveredAt } : {}) }; }
  toPrimitives(): RepairOrderProps { return this.props; }
}
