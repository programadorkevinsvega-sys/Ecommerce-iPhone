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
  if (
    typeof value !== "string" ||
    !SERVICE_CATEGORIES.includes(value as ServiceCategory)
  ) {
    throw new Error("INVALID_SERVICE_CATEGORY");
  }
  return value as ServiceCategory;
}

function parseMetadata(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined) return {};
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error("INVALID_SERVICE_METADATA");
  }

  const metadata: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      throw new Error("INVALID_SERVICE_METADATA");
    }
    metadata[key] = item;
  }
  return metadata;
}

function parseWorkflow(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error("INVALID_SERVICE_WORKFLOW");
  }

  const workflow = value as Record<string, unknown>;
  const allowedStatuses = Array.isArray(workflow.allowedStatuses)
    ? workflow.allowedStatuses.map((status) => {
        if (typeof status !== "string" || !status.trim()) {
          throw new Error("INVALID_SERVICE_WORKFLOW_STATUS");
        }
        return status.trim();
      })
    : ["PENDING", "COMPLETED", "REJECTED"];

  if (!allowedStatuses.includes("PENDING")) {
    throw new Error("SERVICE_WORKFLOW_MUST_ALLOW_PENDING");
  }

  return {
    initialStatus: "PENDING" as const,
    quoteRequired: Boolean(workflow.quoteRequired),
    paymentRequired: Boolean(workflow.paymentRequired),
    technicianApprovalRequired: Boolean(workflow.technicianApprovalRequired),
    adminApprovalRequired: Boolean(workflow.adminApprovalRequired),
    customerOwnershipProofRequired: Boolean(
      workflow.customerOwnershipProofRequired,
    ),
    allowedStatuses,
  };
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

  async create(input: Record<string, unknown>, adminUserId: string) {
    const adminId = adminUserId.trim();
    if (!adminId) throw new Error("ADMIN_ID_REQUIRED");

    const definition = ServiceTypeDefinition.create({
      code: String(input.code ?? "").trim().toUpperCase(),
      slug: String(input.slug ?? "").trim().toLowerCase(),
      name: String(input.name ?? ""),
      description: String(input.description ?? ""),
      category: parseCategory(input.category ?? "OTHER"),
      workflow: parseWorkflow(input.workflow),
      enabled: input.enabled !== false,
      metadata: parseMetadata(input.metadata),
    });

    await this.repository.save(definition);

    const primitives = definition.toPrimitives();
    await this.audit.audit(
      adminId,
      "ADMIN_SERVICE_TYPE_CREATED",
      "service_type",
      primitives.code,
      { slug: primitives.slug },
    );

    return primitives;
  }
}
