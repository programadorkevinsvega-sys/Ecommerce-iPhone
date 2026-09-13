import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminServiceQueryApplication } from "../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";
import { parseServiceRequestStatus } from "../../../../../../modules/services/application/ServiceWorkflowService";

export async function GET(request: Request) {
  try {
    await requireAdmin(PERMISSIONS.servicesRead);
    const raw = new URL(request.url).searchParams.get("status");
    const status = raw ? parseServiceRequestStatus(raw) : undefined;
    const { env } = getCloudflareContext();
    const query = adminServiceQueryApplication(env);
    return NextResponse.json({ items: (await query.list(status)).map((item) => item.toPrimitives()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load services";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : status === 401 ? "Authentication required" : message }, { status });
  }
}
