import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { PERMISSIONS } from "../../../../../../modules/admin/infrastructure/AdminSecurity";
import { D1ServiceTypeRepository } from "../../../../../../modules/services/infrastructure/D1ServiceTypeRepository";
import { ServiceTypeDefinition } from "../../../../../../modules/services/domain/ServiceTypeDefinition";

export async function GET() {
  try {
    const { env } = await requireAdmin(PERMISSIONS.servicesRead);
    const repo = new D1ServiceTypeRepository(env.DB);
    return NextResponse.json({ items: (await repo.listAll()).map((x) => x.toPrimitives()) });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      { error: status === 403 ? "Forbidden" : "Authentication required" },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { admin, repo: adminRepo, env } = await requireAdmin(PERMISSIONS.serviceTypesWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const workflow = body.workflow as Record<string, unknown> | undefined;

    const definition = ServiceTypeDefinition.create({
      code: String(body.code ?? "").trim().toUpperCase(),
      slug: String(body.slug ?? "").trim().toLowerCase(),
      name: String(body.name ?? ""),
      description: String(body.description ?? ""),
      category: String(body.category ?? "OTHER") as "DEVICE" | "NETWORK" | "SOFTWARE" | "REPAIR" | "OTHER",
      workflow: {
        initialStatus: "PENDING",
        quoteRequired: Boolean(workflow?.quoteRequired),
        paymentRequired: Boolean(workflow?.paymentRequired),
        technicianApprovalRequired: Boolean(workflow?.technicianApprovalRequired),
        adminApprovalRequired: Boolean(workflow?.adminApprovalRequired),
        customerOwnershipProofRequired: Boolean(workflow?.customerOwnershipProofRequired),
        allowedStatuses: Array.isArray(workflow?.allowedStatuses)
          ? workflow.allowedStatuses.map(String)
          : ["PENDING", "COMPLETED", "REJECTED"],
      },
      enabled: body.enabled !== false,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? (body.metadata as Record<string, string>)
          : {},
    });

    const repository = new D1ServiceTypeRepository(env.DB);
    await repository.save(definition);
    const primitives = definition.toPrimitives();

    await adminRepo.audit(
      admin.id,
      "ADMIN_SERVICE_TYPE_CREATED",
      "service_type",
      primitives.code,
      { slug: primitives.slug },
    );

    return NextResponse.json(
      { created: true, serviceType: primitives },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid service type" },
      { status: 400 },
    );
  }
}
