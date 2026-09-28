import { NextResponse } from "next/server";
import { cloudflareEnv } from "../../../../../lib/cloudflareContext";
import { adminServiceDetailsApplication, serviceWorkflowApplication } from "../../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { parseServiceRequestStatus } from "../../../../../../../modules/services/application/ServiceWorkflowService";

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
  const status = code.includes("UNAUTHORIZED") ? 401 : code.includes("FORBIDDEN") || code.includes("PERMISSION") ? 403 : code.includes("NOT FOUND") || code.includes("NOT_FOUND") ? 404 : code.includes("CONFLICT") || code.includes("ALREADY") ? 409 : code.includes("INVALID") || code.includes("VALIDATION") ? 422 : code.includes("RATE_LIMIT") ? 429 : 500;
  const message = status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente." : status === 403 ? "No tienes autorización para realizar esta operación." : status === 404 ? "No encontramos la solicitud solicitada." : status === 409 ? "La operación entra en conflicto con el estado actual." : status === 422 ? "Revisa los datos ingresados e inténtalo nuevamente." : status === 429 ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos." : "No pudimos completar la operación.";
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(PERMISSIONS.servicesRead);
    const { id } = await context.params;
    const env = cloudflareEnv();
    return NextResponse.json({ service: (await adminServiceDetailsApplication(env).get(id)).toPrimitives() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin(PERMISSIONS.servicesWrite);
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "").trim().toLowerCase();
    if (!["transition", "quote", "assign", "complete"].includes(action)) {
      return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    }
    const env = cloudflareEnv();
    const workflow = serviceWorkflowApplication(env);
    if (action === "transition") return NextResponse.json({ service: (await workflow.transition(id, parseServiceRequestStatus(body.status), admin.id)).toPrimitives() });
    if (action === "quote") return NextResponse.json({ service: (await workflow.quote(id, Number(body.amountInCents), admin.id)).toPrimitives() });
    if (action === "assign") return NextResponse.json({ service: (await workflow.assign(id, String(body.technicianId ?? ""), admin.id)).toPrimitives() });
    return NextResponse.json({ service: (await workflow.complete(id, String(body.notes ?? ""), admin.id)).toPrimitives() });
  } catch (error) {
    return errorResponse(error);
  }
}
