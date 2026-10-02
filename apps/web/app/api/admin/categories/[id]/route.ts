import { NextResponse } from "next/server";
import { activateAdminCategory, deactivateAdminCategory, deleteAdminCategory, getAdminCategory, updateAdminCategory } from "../../../../../lib/api/adminCategories";
import { normalizeIdentifier } from "../../../../../lib/inputValidation";

type Params = { params: Promise<{ id: string }> };

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "CATEGORY_NOT_FOUND" ? 404 : code === "CATEGORY_SLUG_EXISTS" ? 409 : 400;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Forbidden",
    INVALID_BODY: "Invalid request body",
    INVALID_CATEGORY_NAME: "Valid category name is required",
    INVALID_CATEGORY_SLUG: "Valid category slug is required",
    INVALID_CATEGORY_ACTIVE: "Invalid category status",
    CATEGORY_SLUG_EXISTS: "Category slug already exists",
    CATEGORY_NOT_FOUND: "Category not found",
    NO_EDITABLE_CATEGORY_FIELDS: "No editable fields",
  };
  return noStore(NextResponse.json({ error: messages[code] ?? "Unable to process category" }, { status }));
}

async function idFrom(params: Params["params"]): Promise<string> {
  const { id } = await params;
  const normalized = normalizeIdentifier(id);
  if (!normalized) throw new Error("CATEGORY_NOT_FOUND");
  return normalized;
}

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  try {
    return noStore(NextResponse.json({ category: await getAdminCategory(await idFrom(params)) }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  try {
    return noStore(NextResponse.json({ updated: true, category: await updateAdminCategory(await idFrom(params), await request.json()) }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: Params): Promise<Response> {
  return PATCH(request, context);
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && !Array.isArray(body) && body.action === "activate") {
      await activateAdminCategory(await idFrom(params));
      return noStore(NextResponse.json({ activated: true }));
    }
    return noStore(NextResponse.json({ error: "Invalid category action" }, { status: 400 }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  try {
    const id = await idFrom(params);
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && !Array.isArray(body) && body.action === "deactivate") {
      await deactivateAdminCategory(id);
      return noStore(NextResponse.json({ deactivated: true }));
    }
    await deleteAdminCategory(id);
    return noStore(NextResponse.json({ deleted: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
