import { DomainError } from "../../shared-kernel";
import type { ServiceRequest, ServiceRequestStatus } from "../domain/ServiceRequest";
import type { ServiceTypeRepository } from "./ServiceTypeRepository";
import type { ServiceRequestRepository } from "./ServiceRequestRepository";

export const SERVICE_REQUEST_STATUSES: readonly ServiceRequestStatus[] = [
  "PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING",
  "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED",
];

export function parseServiceRequestStatus(value: unknown): ServiceRequestStatus {
  if (typeof value !== "string" || !SERVICE_REQUEST_STATUSES.includes(value as ServiceRequestStatus)) {
    throw new DomainError("Invalid service status");
  }
  return value as ServiceRequestStatus;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new DomainError(`${field} must be a positive integer`);
  return value;
}

export class ServiceWorkflowService {
  constructor(private readonly requests: ServiceRequestRepository, private readonly types: ServiceTypeRepository) {}

  async transition(requestId: string, status: ServiceRequestStatus, actorId?: string): Promise<ServiceRequest> {
    const request = await this.require(requestId);
    const type = await this.types.findByCode(request.toPrimitives().type);
    if (!type) throw new DomainError("Service type configuration not found");
    if (!type.toPrimitives().workflow.allowedStatuses.includes(status)) throw new DomainError("Status is not allowed by service policy");
    request.transitionTo(status);
    await this.requests.save(request);
    await this.requests.audit(requestId, "ServiceStatusChanged", { status, actorId: actorId ?? null });
    return request;
  }

  async quote(requestId: string, amountInCents: number, actorId?: string): Promise<ServiceRequest> {
    const request = await this.require(requestId);
    const type = await this.types.findByCode(request.toPrimitives().type);
    if (!type) throw new DomainError("Service type configuration not found");
    if (!type.toPrimitives().workflow.quoteRequired) throw new DomainError("This service does not require a quote");
    request.quote(positiveInteger(amountInCents, "Quote"));
    await this.requests.save(request);
    await this.requests.audit(requestId, "ServiceQuoted", { amountInCents, actorId: actorId ?? null });
    return request;
  }

  async assign(requestId: string, technicianId: string, actorId?: string): Promise<ServiceRequest> {
    const normalized = technicianId.trim();
    if (!normalized) throw new DomainError("Technician is required");
    const request = await this.require(requestId);
    request.assign(normalized);
    await this.requests.save(request);
    await this.requests.audit(requestId, "ServiceAssigned", { technicianId: normalized, actorId: actorId ?? null });
    return request;
  }

  async complete(requestId: string, notes: string, actorId?: string): Promise<ServiceRequest> {
    const normalized = notes.trim();
    if (!normalized) throw new DomainError("Resolution notes are required");
    if (normalized.length > 4000) throw new DomainError("Resolution notes are too long");
    const request = await this.require(requestId);
    const type = await this.types.findByCode(request.toPrimitives().type);
    if (!type) throw new DomainError("Service type configuration not found");
    if (!type.toPrimitives().workflow.allowedStatuses.includes("COMPLETED")) throw new DomainError("Completion is not allowed by service policy");
    request.resolve(normalized);
    await this.requests.save(request);
    await this.requests.audit(requestId, "ServiceCompleted", { actorId: actorId ?? null });
    return request;
  }

  private async require(requestId: string): Promise<ServiceRequest> {
    const normalized = requestId.trim();
    if (!normalized) throw new DomainError("Service request id is required");
    const request = await this.requests.findById(normalized);
    if (!request) throw new DomainError("Service request not found");
    return request;
  }
}
