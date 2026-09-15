import type { ServiceTypeDefinition } from "../domain/ServiceTypeDefinition";

export interface ServiceTypeRepository {
  findByCode(code: string): Promise<ServiceTypeDefinition | null>;
  listEnabled(): Promise<ServiceTypeDefinition[]>;
  listAll(): Promise<ServiceTypeDefinition[]>;
  save(type: ServiceTypeDefinition): Promise<void>;
  disable(code: string): Promise<boolean>;
}
