import type { CustomerDevice, CustomerDeviceProps } from "../domain/CustomerDevice";

export type AdminCustomerDevice = CustomerDeviceProps & {
  id: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  customerName: string;
  customerEmail: string;
};

export interface AdminCustomerDeviceRepository {
  list(query: string): Promise<readonly AdminCustomerDevice[]>;
  find(id: string): Promise<CustomerDevice | null>;
  create(device: CustomerDevice): Promise<CustomerDevice>;
  update(id: string, props: CustomerDeviceProps): Promise<CustomerDevice | null>;
  archive(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  recordEvent(customerId: string, deviceId: string, eventType: "CREATED" | "UPDATED" | "ARCHIVED" | "RESTORED", metadata?: Record<string, unknown>): Promise<void>;
}
