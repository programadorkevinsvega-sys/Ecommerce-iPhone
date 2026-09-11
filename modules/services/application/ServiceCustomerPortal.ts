import type { ServiceRequestRepository } from "./ServiceRequestRepository";
import type { ServiceTypeRepository } from "./ServiceTypeRepository";
import { CreateServiceRequest, type CreateServiceRequestInput } from "./CreateServiceRequest";
import type { ServiceRequestFactory } from "./CreateServiceRequest";
import { DomainError } from "../../shared-kernel";

export class ServiceCustomerPortal {
  constructor(
    private readonly requests: ServiceRequestRepository,
    private readonly types: ServiceTypeRepository,
    private readonly factory: ServiceRequestFactory,
  ) {}

  async list(customerId?: string) {
    const services = (await this.types.listEnabled()).map((type) => type.toPrimitives());
    const requests = customerId ? (await this.requests.listForCustomer(customerId)).map((request) => request.toPrimitives()) : [];
    return { services, requests };
  }

  async getOwned(requestId: string, customerId: string) {
    const request = await this.requests.findById(requestId);
    if (!request || request.toPrimitives().customerId !== customerId) throw new DomainError("Service request not found");
    return request.toPrimitives();
  }

  async create(input: CreateServiceRequestInput) {
    const useCase = new CreateServiceRequest(this.types, this.factory);
    const request = await useCase.execute(input);
    await this.requests.save(request);
    await this.requests.audit(request.getId(), "ServiceRequestCreated", {
      type: input.type,
      customerId: input.customerId ?? null,
      deviceBrand: input.deviceBrand,
      deviceModel: input.deviceModel,
      policy: (await this.types.findByCode(input.type))?.toPrimitives().workflow ?? null,
    });
    return { request: request.toPrimitives(), serviceType: (await this.types.findByCode(input.type))?.toPrimitives() ?? null };
  }
}
