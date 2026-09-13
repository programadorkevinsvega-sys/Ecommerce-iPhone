import { NextResponse } from "next/server";
import { createAdminCategory, listAdminCategories } from "../../../../lib/api/adminCategories";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "CATEGORY_SLUG_EXISTS" ? 409 : 400;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Forbidden",
    INVALID_BODY: "Invalid request body",
    INVALID_CATEGORY_NAME: "Valid category name is required",
    INVALID_CATEGORY_SLUG: "Valid category slug is required",
    INVALID_CATEGORY_ACTIVE: "Invalid category status",
    CATEGORY_SLUG_EXISTS: "Category slug already exists",
  };
  return noStore(NextResponse.json({ error: messages[code] ?? "Unable to process category" }, { status }));
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    return noStore(NextResponse.json({ items: await listAdminCategories(url.searchParams.get("q") ?? undefined) }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    return noStore(NextResponse.json({ created: true, category: await createAdminCategory(body) }, { status: 201 }));
  } catch (error) {
    return errorResponse(error);
  }
}
