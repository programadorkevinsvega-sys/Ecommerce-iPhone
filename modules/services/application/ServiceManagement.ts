import { DomainError } from "../../shared-kernel";
import { ServiceRequest, type ServiceRequestStatus } from "../domain/ServiceRequest";

export interface ServiceRequestRepositoryPort { findById(id:string):Promise<ServiceRequest|null>; save(request:ServiceRequest):Promise<void>; audit(id:string,eventType:string,payload:unknown):Promise<void>; }

export class ServiceManagement {
  constructor(private readonly repo:ServiceRequestRepositoryPort) {}
  async quote(id:string, amountInCents:number, actorId:string):Promise<ServiceRequest>{const request=await this.require(id);request.quote(amountInCents);await this.repo.save(request);await this.repo.audit(id,"ServiceQuoted",{actorId,amountInCents});return request;}
  async assign(id:string, technicianId:string, actorId:string):Promise<ServiceRequest>{const request=await this.require(id);request.assign(technicianId);await this.repo.save(request);await this.repo.audit(id,"ServiceAssigned",{actorId,technicianId});return request;}
  async transition(id:string,status:ServiceRequestStatus,actorId:string):Promise<ServiceRequest>{const request=await this.require(id);request.transitionTo(status);await this.repo.save(request);await this.repo.audit(id,"ServiceStatusChanged",{actorId,status});return request;}
  async resolve(id:string,notes:string,actorId:string):Promise<ServiceRequest>{const request=await this.require(id);request.resolve(notes);await this.repo.save(request);await this.repo.audit(id,"ServiceCompleted",{actorId});return request;}
  private async require(id:string){const request=await this.repo.findById(id);if(!request)throw new DomainError("Service request not found");return request;}
}
