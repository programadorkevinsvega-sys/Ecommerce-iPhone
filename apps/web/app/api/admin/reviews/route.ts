import { NextResponse } from "next/server";

import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";
import { adminReviewsApplication } from "../../../../lib/adminApplication";

export async function GET(request: Request) {
  try {
    const { env } = await requireAdmin(PERMISSIONS.reviewsWrite);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 1 || limit > 100 || offset < 0) {
      return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    }
    const items = await adminReviewsApplication(env).list(
      url.searchParams.get("status") ?? undefined,
      url.searchParams.get("productId") ?? undefined,
      limit,
      offset,
    );
    return NextResponse.json({ items, limit, offset }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.reviewsWrite);
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    const status = String(body.status ?? "") as "APPROVED" | "REJECTED";
    const response = body.adminResponse === undefined ? undefined : String(body.adminResponse ?? "");
    const result = await adminReviewsApplication(env).moderate(id, status, response, admin.id);
    return NextResponse.json({ updated: result });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "REVIEW_NOT_FOUND" ? 404 : 400;
  return NextResponse.json(
    { error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : status === 404 ? "Review not found" : code },
    { status },
  );
}
