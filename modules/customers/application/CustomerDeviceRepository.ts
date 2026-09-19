import type { CustomerDevice, CustomerDeviceProps } from "../domain/CustomerDevice";

export type CustomerDeviceEventType = "CREATED" | "UPDATED" | "ARCHIVED";

export interface CustomerDeviceRepository {
  list(customerId: string): Promise<readonly CustomerDevice[]>;
  find(customerId: string, id: string): Promise<CustomerDevice | null>;
  create(props: CustomerDeviceProps): Promise<CustomerDevice>;
  update(customerId: string, id: string, props: CustomerDeviceProps): Promise<CustomerDevice | null>;
  archive(customerId: string, id: string): Promise<boolean>;
  recordEvent(customerId: string, deviceId: string, eventType: CustomerDeviceEventType, metadata?: Record<string, unknown>): Promise<void>;
}
