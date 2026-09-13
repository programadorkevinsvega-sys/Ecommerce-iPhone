import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkoutUseCase, commerceContext } from "../../../lib/commerce";
import { publishNotificationEvent } from "../../../lib/notifications";
import { assertLength, normalizeSingleLine, validateEmail, validatePhone } from "../../../lib/inputValidation";

function safeError(error: unknown): { error: string; status: number } {
  const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
  const known: Record<string, string> = {
    INVALID_EMAIL: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_PHONE: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_NAME: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_ADDRESSLINE: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_CITY: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_STATE: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_POSTALCODE: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_SHIPPING_METHOD: "Revisa los datos ingresados e inténtalo nuevamente.", INVALID_PROMOTIONCODE: "Revisa los datos ingresados e inténtalo nuevamente.",
  };
  if (code.includes("SESSION") || code.includes("UNAUTHORIZED")) return { error: "Tu sesión ya no es válida. Inicia sesión nuevamente.", status: 401 };
  if (code.includes("FORBIDDEN") || code.includes("PERMISSION")) return { error: "No tienes autorización para realizar esta operación.", status: 403 };
  if (code.includes("NOT_FOUND") || code.includes("NOT FOUND")) return { error: "No encontramos el recurso solicitado.", status: 404 };
  if (code.includes("CONFLICT") || code.includes("ALREADY") || code.includes("IDEMPOTENCY")) return { error: "La operación entra en conflicto con el estado actual.", status: 409 };
  if (code.includes("RATE_LIMIT") || code.includes("TOO_MANY")) return { error: "Demasiadas solicitudes. Inténtalo nuevamente en unos minutos.", status: 429 };
  if (known[code] || code.includes("INVALID") || code.includes("VALIDATION")) return { error: known[code] ?? "Revisa los datos ingresados e inténtalo nuevamente.", status: 422 };
  return { error: "No pudimos completar la operación.", status: 500 };
}

export async function POST(request: Request) {
  try {
    const requestCookies = await cookies();
    const cartId = requestCookies.get("cart_id")?.value;
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!cartId) return NextResponse.json({ error: "No encontramos el carrito solicitado." }, { status: 404 });
    if (!idempotencyKey || idempotencyKey.length > 255) return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
    const body = await request.json() as Record<string, unknown>;
    const email = validateEmail(body.email);
    const firstName = assertLength(normalizeSingleLine(body.firstName), "name");
    const lastName = assertLength(normalizeSingleLine(body.lastName), "name");
    const phone = validatePhone(String(body.phone ?? ""));
    const shippingMethod = normalizeSingleLine(body.shippingMethod);
    if (shippingMethod !== "PICKUP" && shippingMethod !== "DELIVERY") throw new Error("INVALID_SHIPPING_METHOD");
    const promotionCode = body.promotionCode === undefined || body.promotionCode === null ? undefined : normalizeSingleLine(body.promotionCode).toUpperCase();
    if (promotionCode !== undefined && !/^[A-Z0-9_-]{3,64}$/u.test(promotionCode)) throw new Error("INVALID_PROMOTIONCODE");
    const rawAddress = body.shippingAddress;
    if (!rawAddress || typeof rawAddress !== "object" || Array.isArray(rawAddress)) throw new Error("INVALID_ADDRESSLINE");
    const address = rawAddress as Record<string, unknown>;
    const shippingPhone = validatePhone(String(address.phone ?? phone));
    const shippingAddress = {
      recipientName: assertLength(normalizeSingleLine(address.recipientName ?? `${firstName} ${lastName}`), "name"), phone: shippingPhone,
      addressLine1: assertLength(normalizeSingleLine(address.addressLine1), "addressLine"), ...(normalizeSingleLine(address.addressLine2) ? { addressLine2: assertLength(normalizeSingleLine(address.addressLine2), "addressLine") } : {}),
      city: assertLength(normalizeSingleLine(address.city), "city"), state: assertLength(normalizeSingleLine(address.state), "state"), ...(normalizeSingleLine(address.postalCode) ? { postalCode: assertLength(normalizeSingleLine(address.postalCode), "postalCode") } : {}), countryCode: normalizeSingleLine(address.countryCode || "CO").toUpperCase(),
    };
    const context = await commerceContext();
    const existingCustomer = await context.customerRepository.findByEmail(email);
    const currentToken = requestCookies.get("customer_session")?.value;
    const currentSession = currentToken ? await context.customerSession.resolve(currentToken) : null;
    if (existingCustomer && (!currentSession || currentSession.customerId !== existingCustomer.getId())) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    if (currentSession) {
      const sessionCustomer = await context.customerRepository.findById(currentSession.customerId);
      if (!sessionCustomer || sessionCustomer.getId() !== existingCustomer?.getId()) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    }
    const customerResult = await context.customer.save({ email, firstName, lastName, phone }, { label: "Principal", ...shippingAddress, isDefault: true });
    await context.cart.claim(cartId, customerResult.customer.getId());
    const cart = await context.cart.getOwnedByCustomer(cartId, customerResult.customer.getId());
    const { checkout } = await checkoutUseCase();
    const order = await checkout.execute(cart, { email: customerResult.customer.toPrimitives().email, shippingAddress, shippingMethod, customerId: customerResult.customer.getId(), idempotencyKey, ...(promotionCode ? { promotionCode } : {}) });
    await publishNotificationEvent({ id: `order-created:${order.id}`, eventType: "OrderCreated", aggregateId: order.id, payload: { email: customerResult.customer.toPrimitives().email, orderId: order.id, orderNumber: order.orderNumber, status: order.status, totalInCents: order.totalInCents, currency: order.currency } });
    const response = NextResponse.json({ order }, { status: 201 });
    if (!currentSession) {
      const newSession = await context.customerSession.create(customerResult.customer.getId());
      response.cookies.set("customer_session", newSession.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }
    response.cookies.set("customer_id", "", { httpOnly: true, maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    const result = safeError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}
