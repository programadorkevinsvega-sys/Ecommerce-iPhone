import { NextResponse } from "next/server";
import { disableAdminServiceType, updateAdminServiceType } from "../../../../../lib/api/adminServiceTypes";

function bodyError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "UNAUTHORIZED") return { status: 401, error: "Authentication required" };
  if (code === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (code === "SERVICE_TYPE_NOT_FOUND") return { status: 404, error: "Service type not found" };
  if (code === "SERVICE_TYPE_NOT_FOUND_OR_DISABLED") return { status: 404, error: "Service type not found or already disabled" };
  return { status: 400, error: "Invalid service type" };
}

export async function PATCH(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    return NextResponse.json({ updated: true, serviceType: await updateAdminServiceType(code, body as Record<string, unknown>) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = bodyError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    return NextResponse.json({ archived: true, serviceType: await disableAdminServiceType(code) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = bodyError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}
