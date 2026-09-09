import { DomainError } from "../../shared-kernel";
import type { ServiceRequest, ServiceRequestStatus } from "../domain/ServiceRequest";
import type { ServiceTypeRepository } from "./ServiceTypeRepository";
import type { ServiceRequestRepository } from "./ServiceRequestRepository";

export class ServiceWorkflowService {
  constructor(private readonly requests: ServiceRequestRepository, private readonly types: ServiceTypeRepository) {}

  async transition(requestId: string, status: ServiceRequestStatus, actorId?: string): Promise<ServiceRequest> {
    const request=await this.requests.findById(requestId);
    if(!request) throw new DomainError("Service request not found");
    const type=await this.types.findByCode(request.toPrimitives().type);
    if(!type) throw new DomainError("Service type configuration not found");
    if(!type.toPrimitives().workflow.allowedStatuses.includes(status)) throw new DomainError("Status is not allowed by service policy");
    request.transitionTo(status);
    await this.requests.save(request);
    await this.requests.audit(requestId,"ServiceStatusChanged",{status,actorId:actorId??null});
    return request;
  }

  async quote(requestId: string, amountInCents: number, actorId?: string): Promise<ServiceRequest> {
    const request=await this.requests.findById(requestId); if(!request) throw new DomainError("Service request not found");
    const type=await this.types.findByCode(request.toPrimitives().type); if(!type) throw new DomainError("Service type configuration not found");
    if(!type.toPrimitives().workflow.quoteRequired) throw new DomainError("This service does not require a quote");
    request.quote(amountInCents); await this.requests.save(request); await this.requests.audit(requestId,"ServiceQuoted",{amountInCents,actorId:actorId??null}); return request;
  }

  async assign(requestId: string, technicianId: string, actorId?: string): Promise<ServiceRequest> {
    const request=await this.requests.findById(requestId); if(!request) throw new DomainError("Service request not found");
    request.assign(technicianId); await this.requests.save(request); await this.requests.audit(requestId,"ServiceAssigned",{technicianId,actorId:actorId??null}); return request;
  }
}
