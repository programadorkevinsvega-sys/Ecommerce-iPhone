import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../../lib/commerce";
import { paymentContext } from "../../../../lib/payments";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const token = (await cookies()).get("customer_session")?.value;
    if (!token) return NextResponse.json({ error: "Customer session required" }, { status: 401 });
    const commerce = await commerceContext();
    const session = await commerce.customerSession.resolve(token);
    if (!session) return NextResponse.json({ error: "Customer session expired" }, { status: 401 });
    const { id } = await context.params;
    if (!id || id.length > 128) return NextResponse.json({ error: "Invalid payment id" }, { status: 400 });
    const payments = await paymentContext();
    const payment = await payments.service.getPayment(id, session.customerId);
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    return NextResponse.json({ payment }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
