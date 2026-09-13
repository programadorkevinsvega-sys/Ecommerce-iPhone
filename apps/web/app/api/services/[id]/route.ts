import { NextResponse } from "next/server";
import { currentCustomerId } from "../../../../lib/customerSession";
import { serviceCustomerPortal } from "../../../../lib/services";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const customerId = await currentCustomerId();
    if (!customerId) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    const requestData = await serviceCustomerPortal().getOwned(id, customerId);
    if (!requestData) return NextResponse.json({ error: "No encontramos la solicitud solicitada." }, { status: 404 });
    return NextResponse.json({ request: requestData }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
    const status = code.includes("NOT FOUND") || code.includes("NOT_FOUND") ? 404 : code.includes("UNAUTHORIZED") || code.includes("SESSION") ? 401 : code.includes("FORBIDDEN") ? 403 : code.includes("CONFLICT") || code.includes("ALREADY") ? 409 : code.includes("INVALID") || code.includes("VALIDATION") ? 422 : code.includes("RATE_LIMIT") ? 429 : 500;
    const message = status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente." : status === 403 ? "No tienes autorización para realizar esta operación." : status === 404 ? "No encontramos la solicitud solicitada." : status === 409 ? "La operación entra en conflicto con el estado actual." : status === 422 ? "Revisa los datos ingresados e inténtalo nuevamente." : status === 429 ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos." : "No pudimos completar la operación.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
