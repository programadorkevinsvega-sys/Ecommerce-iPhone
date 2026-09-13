import { NextResponse } from "next/server";
import { adminPaymentsApplication } from "../../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { env, admin } = await requireAdmin(PERMISSIONS.refundsCreate);
    const { id } = await context.params;
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key || key.length > 255) return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    const result = await (await adminPaymentsApplication(env)).refund(id, key, admin.id);
    return NextResponse.json({ payment: result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
    const status = code.includes("UNAUTHORIZED") ? 401 : code.includes("FORBIDDEN") ? 403 : code.includes("NOT FOUND") || code.includes("NOT_FOUND") ? 404 : code.includes("IDEMPOTENCY") || code.includes("CONFLICT") || code.includes("ALREADY") ? 409 : code.includes("INVALID") || code.includes("VALIDATION") ? 422 : code.includes("RATE_LIMIT") ? 429 : 500;
    const message = status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente." : status === 403 ? "No tienes autorización para realizar esta operación." : status === 404 ? "No encontramos el pago solicitado." : status === 409 ? "La operación entra en conflicto con el estado actual." : status === 422 ? "Revisa los datos ingresados e inténtalo nuevamente." : status === 429 ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos." : "No pudimos completar la operación.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
