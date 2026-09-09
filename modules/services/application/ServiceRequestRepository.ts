import type { ServiceRequest, ServiceRequestStatus } from "../domain/ServiceRequest";

export interface ServiceRequestRepository {
  save(request: ServiceRequest): Promise<void>;
  findById(id: string): Promise<ServiceRequest | null>;
  listForCustomer(customerId: string): Promise<ServiceRequest[]>;
  listQueue(status?: ServiceRequestStatus): Promise<ServiceRequest[]>;
  audit(id: string, eventType: string, payload: unknown): Promise<void>;
}
