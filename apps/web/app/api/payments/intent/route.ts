import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { paymentContext, parsePaymentProvider } from "../../../../lib/payments";
import { commerceContext } from "../../../../lib/commerce";
import { analyticsApp } from "../../../../lib/analyticsApplication";
import { analyticsSetCookie, ANALYTICS_SESSION_COOKIE, ANALYTICS_VISITOR_COOKIE, ensureAnalyticsContext } from "../../../../lib/analyticsContext";
import { cloudflareEnv } from "../../../../lib/cloudflareContext";
import { waitUntil } from "cloudflare:workers";

const ERROR_GENERIC = "No pudimos completar la operación.";
const ERROR_VALIDATION = "Revisa los datos ingresados e inténtalo nuevamente.";

function safePaymentError(error: unknown): Response {
  const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
  const status = code.includes("RATE_LIMIT") || code.includes("TOO_MANY") ? 429 : code.includes("UNAUTHORIZED") || code.includes("SESSION") ? 401 : code.includes("FORBIDDEN") || code.includes("PERMISSION") ? 403 : code.includes("NOT_FOUND") || code.includes("NOT FOUND") ? 404 : code.includes("CONFLICT") || code.includes("ALREADY") || code.includes("IDEMPOTENCY") ? 409 : code.includes("INVALID") || code.includes("VALIDATION") ? 422 : 500;
  const message = status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente." : status === 403 ? "No tienes autorización para realizar esta operación." : status === 404 ? "No encontramos el recurso solicitado." : status === 409 ? "La operación ya fue registrada o entra en conflicto con el estado actual." : status === 422 ? ERROR_VALIDATION : status === 429 ? "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos." : ERROR_GENERIC;
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 255) return NextResponse.json({ error: ERROR_VALIDATION }, { status: 422 });
    const body = await request.json() as { orderId?: unknown; paymentProvider?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) return NextResponse.json({ error: ERROR_VALIDATION }, { status: 422 });
    const paymentProvider = parsePaymentProvider(body.paymentProvider);
    const requestCookies = await cookies();
    const sessionToken = requestCookies.get("customer_session")?.value;
    if (!sessionToken) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    const context = await commerceContext();
    const session = await context.customerSession.resolve(sessionToken);
    if (!session) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    const payments = await paymentContext();
    const order = await payments.orders.findById(orderId);
    if (!order || order.customerId !== session.customerId) return NextResponse.json({ error: "No encontramos el pedido solicitado." }, { status: 404 });
    if (order.status !== "PENDING_PAYMENT") return NextResponse.json({ error: "El pedido no está disponible para pago en este momento." }, { status: 409 });
    const result = await payments.service.createIntent(paymentProvider, {
      orderId: order.id, customerId: session.customerId, amountInCents: order.totalInCents, currency: order.currency,
      idempotencyKey, customerEmail: order.email, customerName: order.shippingAddress.recipientName, customerPhone: order.shippingAddress.phone,
      shippingAddress: { addressLine1: order.shippingAddress.addressLine1, ...(order.shippingAddress.addressLine2 ? { addressLine2: order.shippingAddress.addressLine2 } : {}), city: order.shippingAddress.city, state: order.shippingAddress.state, countryCode: order.shippingAddress.countryCode, phone: order.shippingAddress.phone },
    });
    const analytics=ensureAnalyticsContext(request);
    waitUntil(
      analyticsApp(cloudflareEnv()).record({
        eventId: `payment-started:${result.payment.id}`,
        eventType: "PaymentStarted",
        occurredAt: new Date().toISOString(),
        sessionId: analytics.sessionId,
        visitorId: analytics.visitorId,
        requestId: request.headers.get("x-request-id")?.trim() || undefined,
        payload: {
          orderId: order.id,
          paymentId: result.payment.id,
          provider: result.payment.provider,
          amountInCents: result.payment.amountInCents,
          currency: result.payment.currency,
        },
      }).catch(() => undefined),
    );
    const response = NextResponse.json({ payment: result.payment, checkout: { provider: result.checkout.provider, reference: result.checkout.providerReference, publicKey: result.checkout.publicKey, currency: result.checkout.currency, amountInCents: result.checkout.amountInCents, integritySignature: result.checkout.integritySignature, checkoutUrl: result.checkout.checkoutUrl, ...(result.checkout.clientSecret ? { clientSecret: result.checkout.clientSecret } : {}) } }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return safePaymentError(error);
  }
}
