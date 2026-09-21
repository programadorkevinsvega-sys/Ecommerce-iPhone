import { NextResponse } from "next/server";
import { getAdminPermissionCatalog } from "../../../../../lib/api/adminPermissions";

export async function GET(request: Request) {
  try {
    const role = new URL(request.url).searchParams.get("role") ?? "";
    return NextResponse.json({ items: await getAdminPermissionCatalog(role) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: code === "INVALID_ROLE" ? "Invalid role" : "Unable to load permissions" }, { status });
  }
}
