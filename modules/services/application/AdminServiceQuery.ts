import type { ServiceRequest, ServiceRequestStatus } from "../domain/ServiceRequest";
import type { ServiceRequestRepository } from "./ServiceRequestRepository";

export interface AdminServiceQuery {
  list(status?: ServiceRequestStatus): Promise<readonly ServiceRequest[]>;
}

export class AdminServiceQueryService implements AdminServiceQuery {
  constructor(private readonly repository: ServiceRequestRepository) {}

  async list(status?: ServiceRequestStatus): Promise<readonly ServiceRequest[]> {
    return this.repository.listQueue(status);
  }
}
