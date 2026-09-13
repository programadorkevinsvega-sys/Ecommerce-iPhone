import { NextResponse } from "next/server";
import { normalizeIdentifier } from "../../../../../../../lib/inputValidation";
import { adminResources } from "../../../../../../../lib/adminResources";
import { requireAdmin } from "../../../../../../../lib/adminAuth";

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code.endsWith("_NOT_FOUND") ? 404 : 400;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Forbidden",
    PRODUCT_NOT_FOUND: "Product not found",
    INVALID_PRODUCT_CATEGORIES: "Invalid product categories",
  };
  return NextResponse.json({ error: messages[code] ?? "Unable to process product categories" }, { status, headers: { "Cache-Control": "no-store" } });
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const id = normalizeIdentifier((await context.params).id);
    if (!id) throw new Error("PRODUCT_NOT_FOUND");
    const { admin } = await requireAdmin();
    const { service } = adminResources();
    return NextResponse.json({ categoryIds: await service.getProductCategoryIds({ actor: admin, productId: id }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const id = normalizeIdentifier((await context.params).id);
    if (!id) throw new Error("PRODUCT_NOT_FOUND");
    const body = bodyRecord(await request.json());
    const { admin } = await requireAdmin();
    const { service } = adminResources();
    await service.replaceProductCategories({ actor: admin, productId: id, categoryIds: body.category_ids });
    return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
