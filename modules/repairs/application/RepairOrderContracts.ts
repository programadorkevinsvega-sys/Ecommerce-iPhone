import type { RepairOrderStatus, DeviceCondition } from "../domain/RepairOrder";

export type { RepairOrderStatus, DeviceCondition };
export const REPAIR_ORDER_STATUSES: readonly RepairOrderStatus[] = [
  "RECEIVED","DIAGNOSING","WAITING_APPROVAL","WAITING_PART","IN_REPAIR",
  "QUALITY_CONTROL","READY","DELIVERED","CANCELLED",
];
export const REPAIR_DEVICE_CONDITIONS: readonly DeviceCondition[] = [
  "FUNCTIONAL","NOT_FUNCTIONAL","DAMAGED","NOT_TESTED","NOT_APPLICABLE",
];
