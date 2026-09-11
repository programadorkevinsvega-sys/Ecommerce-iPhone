import { NextResponse } from "next/server";
import { createAdminUser, listAdminUsers, updateAdminUser } from "../../../../lib/api/adminUsers";

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : code === "ADMIN_NOT_FOUND" ? 404 : code === "ADMIN_ALREADY_EXISTS" ? 409 : 400;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Forbidden",
    ADMIN_NOT_FOUND: "Admin not found",
    ADMIN_ALREADY_EXISTS: "Admin already exists",
    SELF_DEACTIVATION_FORBIDDEN: "You cannot deactivate your own account",
    INVALID_ADMIN_DATA: "Invalid admin data",
    INVALID_ROLE: "Invalid role",
    ID_REQUIRED: "id required",
    INVALID_BODY: "Invalid request body",
  };
  return NextResponse.json({ error: messages[code] ?? "Unable to process admin user" }, { status });
}

export async function GET() {
  try { return NextResponse.json({ items: await listAdminUsers() }); } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try { const id = await createAdminUser(bodyRecord(await request.json())); return NextResponse.json({ created: true, id }, { status: 201 }); } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try { await updateAdminUser(bodyRecord(await request.json())); return NextResponse.json({ updated: true }); } catch (error) { return errorResponse(error); }
}
