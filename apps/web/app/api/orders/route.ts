import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ListOrdersForCustomer } from "../../../../../modules/orders/application/ListOrdersForCustomer";
import { commerceContext } from "../../../lib/commerce";

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get("customer_session")?.value;
    if (!token) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });

    const context = await commerceContext();
    const session = await context.customerSession.resolve(token);
    if (!session) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    if (!Number.isFinite(limit) || !Number.isFinite(offset) || limit < 1 || limit > 100 || offset < 0) {
      return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    }

    const page = await new ListOrdersForCustomer(context.orderRepository).execute(session.customerId, limit, offset);
    return NextResponse.json({ orders: page.items, limit: page.limit, offset: page.offset }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la operación." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
