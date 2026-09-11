import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { paymentContext, parsePaymentProvider } from "../../../../lib/payments";
import { commerceContext } from "../../../../lib/commerce";

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 255) return NextResponse.json({ error: "A valid Idempotency-Key header is required" }, { status: 400 });
    const body = await request.json() as { orderId?: unknown; paymentProvider?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    const paymentProvider = parsePaymentProvider(body.paymentProvider);
    const requestCookies = await cookies();
    const sessionToken = requestCookies.get("customer_session")?.value;
    if (!sessionToken) return NextResponse.json({ error: "Customer session required" }, { status: 401 });
    const context = await commerceContext();
    const session = await context.customerSession.resolve(sessionToken);
    if (!session) return NextResponse.json({ error: "Customer session expired" }, { status: 401 });
    const payments = await paymentContext();
    const order = await payments.orders.findById(orderId);
    if (!order || order.customerId !== session.customerId) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "PENDING_PAYMENT") return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 409 });
    const result = await payments.service.createIntent(paymentProvider, {
      orderId: order.id, customerId: session.customerId, amountInCents: order.totalInCents, currency: order.currency,
      idempotencyKey, customerEmail: order.email, customerName: order.shippingAddress.recipientName, customerPhone: order.shippingAddress.phone,
      shippingAddress: { addressLine1: order.shippingAddress.addressLine1, ...(order.shippingAddress.addressLine2 ? { addressLine2: order.shippingAddress.addressLine2 } : {}), city: order.shippingAddress.city, state: order.shippingAddress.state, countryCode: order.shippingAddress.countryCode, phone: order.shippingAddress.phone },
    });
    return NextResponse.json({ payment: result.payment, checkout: { provider: result.checkout.provider, reference: result.checkout.providerReference, publicKey: result.checkout.publicKey, currency: result.checkout.currency, amountInCents: result.checkout.amountInCents, integritySignature: result.checkout.integritySignature, checkoutUrl: result.checkout.checkoutUrl, ...(result.checkout.clientSecret ? { clientSecret: result.checkout.clientSecret } : {}) } }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment intent failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
