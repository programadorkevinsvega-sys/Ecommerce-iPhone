import { ServiceRequest, type ServiceRequestProps } from "../domain/ServiceRequest";
import type { ServiceTypeDefinition } from "../domain/ServiceTypeDefinition";
import type { CreateServiceRequestInput, ServiceRequestFactory as ServiceRequestFactoryPort } from "../application/CreateServiceRequest";

export class ServiceRequestFactory implements ServiceRequestFactoryPort {
  create(input: CreateServiceRequestInput, _definition: ServiceTypeDefinition): ServiceRequest {
    const props: Omit<ServiceRequestProps, "status" | "createdAt" | "updatedAt"> = {
      customerId: input.customerId,
      email: input.email,
      type: input.type,
      deviceBrand: input.deviceBrand,
      deviceModel: input.deviceModel,
      deviceSerialLast4: input.deviceSerialLast4,
      imeiLast4: input.imeiLast4,
      carrier: input.carrier,
      problemDescription: input.problemDescription,
      customerNotes: input.customerNotes,
      currency: input.currency,
    };
    return ServiceRequest.create(input.id, props);
  }
}
