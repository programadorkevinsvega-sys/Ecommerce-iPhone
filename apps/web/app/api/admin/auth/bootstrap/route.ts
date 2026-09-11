import { NextResponse } from "next/server";
import { bootstrapAdmin } from "../../../../../lib/adminAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const id = await bootstrapAdmin(body as Record<string, unknown>, request.headers.get("X-Admin-Bootstrap-Token"));
    return NextResponse.json({ created: true, adminId: id }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "NOT_FOUND" ? 404 : code === "ADMIN_ALREADY_EXISTS" ? 409 : 400;
    return NextResponse.json({ error: status === 404 ? "Not found" : status === 409 ? "Admin already exists" : "Invalid admin data" }, { status });
  }
}
