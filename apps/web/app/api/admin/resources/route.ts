import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../../lib/adminAuth";
import { adminResources } from "../../../../lib/adminResources";
import { normalizeIdentifier, normalizeSearchQuery } from "../../../../lib/inputValidation";
import type { ResourceName } from "../../../../../../modules/admin/application/AdminResources";

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status =
    code === "UNAUTHORIZED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code.endsWith("_NOT_FOUND")
          ? 404
          : 400;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Forbidden",
    INVALID_BODY: "Invalid request body",
    INVALID_PRODUCT: "Invalid product",
    INVALID_PRODUCT_IMAGES: "A product can have at most 5 valid images",
    INVALID_SERVICE_QUOTE: "Valid service id and quote are required",
    INVALID_ORDER_STATUS: "Invalid order status",
    INVALID_SERVICE_STATUS: "Invalid service status",
    NO_EDITABLE_FIELDS: "No editable fields",
    SERVICE_NOT_FOUND: "Service request not found",
    ORDER_NOT_FOUND: "Order not found",
    UNSUPPORTED_RESOURCE: "Unsupported resource",
    UNSUPPORTED_CREATE: "Unsupported resource",
    UNSUPPORTED_UPDATE: "Unsupported resource",
    UNSUPPORTED_DELETE: "Unsupported resource",
    PRODUCT_NOT_FOUND: "Product not found",
    PRODUCT_IN_USE: "Product cannot be deleted because it is referenced by commerce or review history",
  };
  return NextResponse.json({ error: messages[code] ?? "Unable to process request" }, { status });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const resource = (url.searchParams.get("resource") ?? "orders") as ResourceName;
    const query = normalizeSearchQuery(url.searchParams.get("q"));
    const { admin } = await requireAdmin();
    const { service } = adminResources();
    const items = await service.list({ actor: admin, resource, query });
    return NextResponse.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = bodyRecord(await request.json());
    const resource = body.resource as ResourceName;
    const { admin } = await requireAdmin();
    const { service } = adminResources();
    const result = await service.create({ actor: admin, resource, body });
    if (resource === "products") {
      const slug = typeof body.slug === "string" ? body.slug : undefined;
      if (slug) revalidatePath(`/iphone/${slug}`);
    }
    return NextResponse.json(
      { created: Boolean(result.id), ...result },
      { status: result.id ? 201 : 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = bodyRecord(await request.json());
    const resource = body.resource as ResourceName;
    const id = normalizeIdentifier(body.id);
    if (!id) return NextResponse.json({ error: "Resource id is required" }, { status: 400 });
    const { admin } = await requireAdmin();
    const { service } = adminResources();
    await service.update({ actor: admin, resource, id, body });
    if (resource === "products" && typeof body.slug === "string") {
      revalidatePath(`/iphone/${body.slug}`);
    }
    return NextResponse.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const body = bodyRecord(await request.json());
    const resource = body.resource as ResourceName;
    const id = normalizeIdentifier(body.id);
    if (!id) return NextResponse.json({ error: "Resource id is required" }, { status: 400 });
    const { admin } = await requireAdmin();
    const { service } = adminResources();
    await service.delete({ actor: admin, resource, id });
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
