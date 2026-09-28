import { NextResponse } from "next/server";
import { cloudflareEnv } from "../../../../lib/cloudflareContext";
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
    return NextResponse.json({ items: (await query.list(status)).map((item) => item.toPrimitives()) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : code.includes("INVALID") || code.includes("VALIDATION") ? 422 : code.includes("RATE_LIMIT") ? 429 : 500;
    const message = status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente." : status === 403 ? "No tienes autorización para realizar esta operación." : status === 422 ? "Revisa los datos ingresados e inténtalo nuevamente." : status === 429 ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos." : "No pudimos completar la operación.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
