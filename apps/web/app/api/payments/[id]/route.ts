import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../../lib/commerce";
import { paymentContext } from "../../../../lib/payments";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const token = (await cookies()).get("customer_session")?.value;
    if (!token) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    const commerce = await commerceContext();
    const session = await commerce.customerSession.resolve(token);
    if (!session) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    const { id } = await context.params;
    if (!id || id.length > 128) return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    const payment = await (await paymentContext()).service.getPayment(id, session.customerId);
    if (!payment) return NextResponse.json({ error: "No encontramos el pago solicitado." }, { status: 404 });
    return NextResponse.json({ payment }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la operación." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
