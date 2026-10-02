import { NextResponse } from "next/server";
import { deleteAdminServiceType, disableAdminServiceType, enableAdminServiceType, updateAdminServiceType } from "../../../../../lib/api/adminServiceTypes";

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

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && !Array.isArray(body) && body.action === "activate") {
      return NextResponse.json({ activated: true, serviceType: await enableAdminServiceType(code) }, { headers: { "cache-control": "no-store" } });
    }
    if (body && typeof body === "object" && !Array.isArray(body) && body.action === "deactivate") {
      return NextResponse.json({ deactivated: true, serviceType: await disableAdminServiceType(code) }, { headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({ error: "Invalid service type action" }, { status: 400, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = bodyError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    return NextResponse.json({ deleted: true, serviceType: await deleteAdminServiceType(code) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = bodyError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}
