import {
  ServiceTypeDefinition,
  type ServiceCategory,
} from "../domain/ServiceTypeDefinition";
import type { ServiceTypeRepository } from "./ServiceTypeRepository";

export interface ServiceTypeAuditPort {
  audit(
    adminUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    payload: unknown,
  ): Promise<void>;
}

const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  "DEVICE",
  "NETWORK",
  "SOFTWARE",
  "REPAIR",
  "OTHER",
];

function parseCategory(value: unknown): ServiceCategory {
  if (typeof value !== "string" || !SERVICE_CATEGORIES.includes(value as ServiceCategory)) {
    throw new Error("INVALID_SERVICE_CATEGORY");
  }
  return value as ServiceCategory;
}

function parseMetadata(value: unknown) {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_SERVICE_METADATA");
  }
  const metadata: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key.trim() || key.length > 80 || typeof item !== "string" || item.length > 500) {
      throw new Error("INVALID_SERVICE_METADATA");
    }
    metadata[key] = item;
  }
  return metadata;
}

function parseWorkflow(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_SERVICE_WORKFLOW");
  }
  const workflow = value as Record<string, unknown>;
  const allowedStatuses = Array.isArray(workflow.allowedStatuses)
    ? workflow.allowedStatuses.map((status) => {
        if (typeof status !== "string" || !status.trim()) throw new Error("INVALID_SERVICE_WORKFLOW_STATUS");
        return status.trim();
      })
    : ["PENDING", "COMPLETED", "REJECTED"];
  const uniqueStatuses = [...new Set(allowedStatuses)];
  if (!uniqueStatuses.includes("PENDING")) throw new Error("SERVICE_WORKFLOW_MUST_ALLOW_PENDING");
  return {
    initialStatus: "PENDING" as const,
    quoteRequired: Boolean(workflow.quoteRequired),
    paymentRequired: Boolean(workflow.paymentRequired),
    technicianApprovalRequired: Boolean(workflow.technicianApprovalRequired),
    adminApprovalRequired: Boolean(workflow.adminApprovalRequired),
    customerOwnershipProofRequired: Boolean(workflow.customerOwnershipProofRequired),
    allowedStatuses: uniqueStatuses,
  };
}

function optionalMoney(value: unknown, code: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function optionalPositiveInteger(value: unknown, code: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(code);
  return parsed;
}

function parseCompatibility(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error("INVALID_SERVICE_COMPATIBILITY");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("INVALID_SERVICE_COMPATIBILITY");
    const row = item as Record<string, unknown>;
    const brand = String(row.brand ?? "").trim();
    const model = String(row.model ?? "").trim();
    if (!brand || brand.length > 80 || (model && model.length > 120)) throw new Error("INVALID_SERVICE_COMPATIBILITY");
    return { brand, ...(model ? { model } : {}) };
  });
}

function parseRequirements(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new Error("INVALID_SERVICE_REQUIREMENTS");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("INVALID_SERVICE_REQUIREMENTS");
    const row = item as Record<string, unknown>;
    const description = String(row.description ?? "").trim();
    if (!description || description.length > 240) throw new Error("INVALID_SERVICE_REQUIREMENTS");
    return { description, required: row.required !== false };
  });
}

export class AdminServiceTypes {
  constructor(
    private readonly repository: ServiceTypeRepository,
    private readonly audit: ServiceTypeAuditPort,
  ) {}

  async list() {
    const definitions = await this.repository.listAll();
    return definitions.map((definition) => definition.toPrimitives());
  }

  private buildDefinition(input: Record<string, unknown>, existing?: ReturnType<ServiceTypeDefinition["toPrimitives"]>) {
    const priceFromInCents = optionalMoney(input.priceFromInCents, "INVALID_SERVICE_PRICE");
    const fixedPriceInCents = optionalMoney(input.fixedPriceInCents, "INVALID_SERVICE_PRICE");
    const estimatedMinutes = optionalPositiveInteger(input.estimatedMinutes, "INVALID_SERVICE_TIME");
    const warrantyDays = optionalPositiveInteger(input.warrantyDays, "INVALID_SERVICE_WARRANTY");
    const workflow = parseWorkflow(input.workflow ?? existing?.workflow);
    const definitionInput: Parameters<typeof ServiceTypeDefinition.create>[0] = {
      code: existing?.code ?? String(input.code ?? "").trim().toUpperCase(),
      slug: String(input.slug ?? existing?.slug ?? "").trim().toLowerCase(),
      name: String(input.name ?? existing?.name ?? ""),
      description: String(input.description ?? existing?.description ?? ""),
      ...(typeof input.imageUrl === "string"
        ? { imageUrl: input.imageUrl }
        : existing?.imageUrl
          ? { imageUrl: existing.imageUrl }
          : {}),
      category: parseCategory(input.category ?? existing?.category ?? "OTHER"),
      workflow,
      enabled: input.enabled === undefined ? existing?.enabled !== false : input.enabled === true,
      metadata: parseMetadata(input.metadata ?? existing?.metadata),
      requiresDiagnosis: input.requiresDiagnosis === undefined ? existing?.requiresDiagnosis === true : input.requiresDiagnosis === true,
      requiresApproval: input.requiresApproval === undefined ? existing?.requiresApproval === true : input.requiresApproval === true,
      compatibility: parseCompatibility(input.compatibility ?? existing?.compatibility),
      requirements: parseRequirements(input.requirements ?? existing?.requirements),
      ...(existing ? { createdAt: existing.createdAt } : {}),
    };

    if (priceFromInCents !== undefined) definitionInput.priceFromInCents = priceFromInCents;
    else if (existing?.priceFromInCents !== undefined) definitionInput.priceFromInCents = existing.priceFromInCents;

    if (fixedPriceInCents !== undefined) definitionInput.fixedPriceInCents = fixedPriceInCents;
    else if (existing?.fixedPriceInCents !== undefined) definitionInput.fixedPriceInCents = existing.fixedPriceInCents;

    if (estimatedMinutes !== undefined) definitionInput.estimatedMinutes = estimatedMinutes;
    else if (existing?.estimatedMinutes !== undefined) definitionInput.estimatedMinutes = existing.estimatedMinutes;

    if (warrantyDays !== undefined) definitionInput.warrantyDays = warrantyDays;
    else if (existing?.warrantyDays !== undefined) definitionInput.warrantyDays = existing.warrantyDays;

    return ServiceTypeDefinition.create(definitionInput);
  }

  async create(input: Record<string, unknown>, adminUserId: string) {
    const adminId = adminUserId.trim();
    if (!adminId) throw new Error("ADMIN_ID_REQUIRED");
    const definition = this.buildDefinition(input);
    await this.repository.save(definition);
    const primitives = definition.toPrimitives();
    await this.audit.audit(adminId, "ADMIN_SERVICE_TYPE_CREATED", "service_type", primitives.code, { slug: primitives.slug });
    return primitives;
  }

  async update(code: string, input: Record<string, unknown>, adminUserId: string) {
    const adminId = adminUserId.trim();
    const serviceCode = code.trim().toUpperCase();
    if (!adminId) throw new Error("ADMIN_ID_REQUIRED");
    if (!serviceCode) throw new Error("SERVICE_TYPE_CODE_REQUIRED");
    const existing = await this.repository.findByCode(serviceCode);
    if (!existing) throw new Error("SERVICE_TYPE_NOT_FOUND");
    const definition = this.buildDefinition(input, existing.toPrimitives());
    await this.repository.save(definition);
    const primitives = definition.toPrimitives();
    await this.audit.audit(adminId, "ADMIN_SERVICE_TYPE_UPDATED", "service_type", serviceCode, { slug: primitives.slug, enabled: primitives.enabled });
    return primitives;
  }

  async disable(code: string, adminUserId: string) {
    const adminId = adminUserId.trim();
    const serviceCode = code.trim().toUpperCase();
    if (!adminId) throw new Error("ADMIN_ID_REQUIRED");
    if (!serviceCode) throw new Error("SERVICE_TYPE_CODE_REQUIRED");
    const changed = await this.repository.disable(serviceCode);
    if (!changed) throw new Error("SERVICE_TYPE_NOT_FOUND_OR_DISABLED");
    await this.audit.audit(adminId, "ADMIN_SERVICE_TYPE_DISABLED", "service_type", serviceCode, { enabled: false });
    return { code: serviceCode, enabled: false };
  }
}