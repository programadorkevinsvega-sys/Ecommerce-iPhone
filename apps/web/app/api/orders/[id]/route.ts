import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../../lib/commerce";
import { GetOrderForCustomer } from "../../../../../../modules/orders/application/GetOrderForCustomer";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Order id is required" }, { status: 400 });
    const customerId = (await cookies()).get("customer_id")?.value;
    if (!customerId) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const { orderRepository } = await commerceContext();
    const order = await new GetOrderForCustomer(orderRepository).execute(id, customerId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load order" }, { status: 500 });
  }
}
