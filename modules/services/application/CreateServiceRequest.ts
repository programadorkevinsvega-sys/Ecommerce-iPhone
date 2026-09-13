import { DomainError } from "../../shared-kernel";
import type { ServiceRequest } from "../domain/ServiceRequest";
import type { ServiceTypeDefinition } from "../domain/ServiceTypeDefinition";
import type { ServiceTypeRepository } from "./ServiceTypeRepository";

export type CreateServiceRequestInput = Readonly<{
  id: string;
  customerId?: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  countryCode?: string;
  type: string;
  deviceBrand: string;
  deviceModel: string;
  deviceSerialLast4?: string;
  imeiLast4?: string;
  carrier?: string;
  problemDescription: string;
  customerNotes?: string;
  currency: string;
}>;

export interface ServiceRequestFactory {
  create(input: CreateServiceRequestInput, definition: ServiceTypeDefinition): ServiceRequest;
}

export class CreateServiceRequest {
  constructor(private readonly types: ServiceTypeRepository, private readonly factory: ServiceRequestFactory) {}

  async execute(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    const definition = await this.types.findByCode(input.type);
    if (!definition || !definition.toPrimitives().enabled) throw new DomainError("Service type is not available");
    const workflow = definition.toPrimitives().workflow;
    if (workflow.customerOwnershipProofRequired && !input.imeiLast4 && !input.deviceSerialLast4) {
      throw new DomainError("Device ownership information is required for this service");
    }
    return this.factory.create(input, definition);
  }
}
