import { ServiceRequest, type ServiceRequestProps } from "../domain/ServiceRequest";
import type { ServiceTypeDefinition } from "../domain/ServiceTypeDefinition";
import type { CreateServiceRequestInput, ServiceRequestFactory as ServiceRequestFactoryPort } from "../application/CreateServiceRequest";

export class ServiceRequestFactory implements ServiceRequestFactoryPort {
  create(input: CreateServiceRequestInput, _definition: ServiceTypeDefinition): ServiceRequest {
    const props: Omit<ServiceRequestProps, "status" | "createdAt" | "updatedAt"> = {
      email: input.email,
      type: input.type,
      deviceBrand: input.deviceBrand,
      deviceModel: input.deviceModel,
      problemDescription: input.problemDescription,
      currency: input.currency,
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.deviceSerialLast4 !== undefined ? { deviceSerialLast4: input.deviceSerialLast4 } : {}),
      ...(input.imeiLast4 !== undefined ? { imeiLast4: input.imeiLast4 } : {}),
      ...(input.carrier !== undefined ? { carrier: input.carrier } : {}),
      ...(input.customerNotes !== undefined ? { customerNotes: input.customerNotes } : {}),
    };
    return ServiceRequest.create(input.id, props);
  }
}
