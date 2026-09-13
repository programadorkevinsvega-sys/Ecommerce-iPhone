import type { ServiceRequest } from "../domain/ServiceRequest";
import type { ServiceRequestRepository } from "./ServiceRequestRepository";

export interface AdminServiceDetails {
  get(id: string): Promise<ServiceRequest>;
}

export class AdminServiceDetailsService implements AdminServiceDetails {
  constructor(private readonly repository: ServiceRequestRepository) {}

  async get(id: string): Promise<ServiceRequest> {
    const normalized = id.trim();
    if (!normalized) throw new Error("Service request id is required");
    const request = await this.repository.findById(normalized);
    if (!request) throw new Error("Service request not found");
    return request;
  }
}
