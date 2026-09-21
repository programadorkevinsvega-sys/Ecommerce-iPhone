import { NextResponse } from "next/server";
import {
  getAdminUserPermissions,
  updateAdminUserPermissions,
} from "../../../../../../lib/api/adminPermissions";

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status =
    code === "FORBIDDEN" ||
    code === "PERMISSION_ESCALATION_FORBIDDEN"
      ? 403
      : code === "UNAUTHORIZED"
        ? 401
        : code === "ADMIN_NOT_FOUND"
          ? 404
          : 400;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Forbidden",
    ADMIN_NOT_FOUND: "Admin not found",
    ID_REQUIRED: "id required",
    INVALID_BODY: "Invalid request body",
    INVALID_PERMISSIONS: "Invalid permissions payload",
    ADMIN_SELF_PERMISSIONS_CHANGE_FORBIDDEN: "You cannot change your own permissions",
    SUPER_ADMIN_PERMISSIONS_PROTECTED: "Super admin permissions are protected",
    PERMISSION_ESCALATION_FORBIDDEN: "You cannot grant a permission you do not have",
  };
  return NextResponse.json(
    { error: messages[code] ?? "Unable to process admin permissions" },
    { status },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ items: await getAdminUserPermissions(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = bodyRecord(await request.json());
    await updateAdminUserPermissions(id, body.overrides);
    return NextResponse.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
