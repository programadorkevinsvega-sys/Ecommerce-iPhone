import { D1ServiceTypeRepository } from "../../../modules/services/infrastructure/D1ServiceTypeRepository";
import { ServiceTypeDefinition, type ServiceTypeCategory } from "../../../modules/services/domain/ServiceTypeDefinition";
import { adminRepository, PERMISSIONS, requireAdmin } from "../adminAuth";

export async function listAdminServiceTypes() {
  const { env } = await requireAdmin(PERMISSIONS.servicesRead);
  const repo = new D1ServiceTypeRepository(env.DB);
  return (await repo.listAll()).map((item) => item.toPrimitives());
}

export async function createAdminServiceType(body: Record<string, unknown>) {
  const { admin, env } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
  const workflow = body.workflow as Record<string, unknown> | undefined;
  const definition = ServiceTypeDefinition.create({
    code: String(body.code ?? "").trim().toUpperCase(),
    slug: String(body.slug ?? "").trim().toLowerCase(),
    name: String(body.name ?? ""),
    description: String(body.description ?? ""),
    category: String(body.category ?? "OTHER") as ServiceTypeCategory,
    workflow: {
      initialStatus: "PENDING",
      quoteRequired: Boolean(workflow?.quoteRequired),
      paymentRequired: Boolean(workflow?.paymentRequired),
      technicianApprovalRequired: Boolean(workflow?.technicianApprovalRequired),
      adminApprovalRequired: Boolean(workflow?.adminApprovalRequired),
      customerOwnershipProofRequired: Boolean(workflow?.customerOwnershipProofRequired),
      allowedStatuses: Array.isArray(workflow?.allowedStatuses) ? workflow.allowedStatuses.map(String) : ["PENDING", "COMPLETED", "REJECTED"],
    },
    enabled: body.enabled !== false,
    metadata: body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, string>) : {},
  });
  const repository = new D1ServiceTypeRepository(env.DB);
  await repository.save(definition);
  const primitives = definition.toPrimitives();
  const { repo } = await adminRepository();
  await repo.audit(admin.id, "ADMIN_SERVICE_TYPE_CREATED", "service_type", primitives.code, { slug: primitives.slug });
  return primitives;
}
