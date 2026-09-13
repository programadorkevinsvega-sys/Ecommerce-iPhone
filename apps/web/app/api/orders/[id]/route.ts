import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../../lib/commerce";
import { GetOrderForCustomer } from "../../../../../../modules/orders/application/GetOrderForCustomer";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    const token = (await cookies()).get("customer_session")?.value;
    if (!token) return NextResponse.json({ error: "No encontramos el pedido solicitado." }, { status: 404 });
    const context = await commerceContext();
    const session = await context.customerSession.resolve(token);
    if (!session) return NextResponse.json({ error: "No encontramos el pedido solicitado." }, { status: 404 });
    const order = await new GetOrderForCustomer(context.orderRepository).execute(id, session.customerId);
    if (!order) return NextResponse.json({ error: "No encontramos el pedido solicitado." }, { status: 404 });
    return NextResponse.json({ order }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la operación." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
