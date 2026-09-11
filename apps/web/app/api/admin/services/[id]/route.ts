import { NextResponse } from "next/server";
import { getAdminService, mutateAdminService } from "../../../../../lib/api/adminServices";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ service: await getAdminService(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load service";
    const status = message === "NOT_FOUND" ? 404 : message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 404 ? "Service request not found" : status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "").trim().toLowerCase();
    if (!["transition", "quote", "assign", "complete"].includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    return NextResponse.json({ service: await mutateAdminService(id, action, body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update service";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
