import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ListOrdersForCustomer } from "../../../../../modules/orders/application/ListOrdersForCustomer";
import { commerceContext } from "../../../lib/commerce";

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get("customer_session")?.value;
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const context = await commerceContext();
    const session = await context.customerSession.resolve(token);
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    if (!Number.isFinite(limit) || !Number.isFinite(offset) || limit < 1 || offset < 0) {
      return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    }

    const page = await new ListOrdersForCustomer(context.orderRepository).execute(session.customerId, limit, offset);
    return NextResponse.json({ orders: page.items, limit: page.limit, offset: page.offset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load orders" }, { status: 500 });
  }
}
