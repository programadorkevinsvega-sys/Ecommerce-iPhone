import { NextResponse } from "next/server";
import { deleteAdminCustomer, listAdminCustomers, updateAdminCustomer } from "../../../../lib/api/adminCustomers";

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "CUSTOMER_NOT_FOUND" ? 404 : 400;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Forbidden",
    INVALID_BODY: "Invalid request body",
    INVALID_CUSTOMER_DATA: "Valid customer name is required",
    INVALID_CUSTOMER_PHONE: "Invalid customer phone",
    CUSTOMER_NOT_FOUND: "Customer not found",
  };
  return NextResponse.json({ error: messages[code] ?? "Unable to process customer" }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  try {
    return NextResponse.json({ items: await listAdminCustomers(new URL(request.url).searchParams.get("q")) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = bodyRecord(await request.json());
    const id = typeof body.id === "string" ? body.id : "";
    await updateAdminCustomer(id, body);
    return NextResponse.json({ updated: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const body = bodyRecord(await request.json());
    await deleteAdminCustomer(typeof body.id === "string" ? body.id : "");
    return NextResponse.json({ deleted: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
