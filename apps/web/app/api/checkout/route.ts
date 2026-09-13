import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkoutUseCase, commerceContext } from "../../../lib/commerce";
import { publishNotificationEvent } from "../../../lib/notifications";
import { assertLength, normalizeSingleLine, validateEmail, validatePhone } from "../../../lib/inputValidation";

function safeError(error: unknown): { error: string; status: number } {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const known: Record<string,string> = {
    INVALID_EMAIL: "Invalid email",
    INVALID_PHONE: "Invalid phone",
    INVALID_NAME: "Name fields are invalid",
    INVALID_ADDRESSLINE: "Shipping address is invalid",
    INVALID_CITY: "City is invalid",
    INVALID_STATE: "Department is invalid",
    INVALID_POSTALCODE: "Postal code is invalid",
    INVALID_SHIPPING_METHOD: "Invalid shipping method",
    INVALID_PROMOTIONCODE: "Invalid promotion code",
  };
  if (code.includes("session") || code === "Customer session required") return { error: "Customer session required", status: 401 };
  return { error: known[code] ?? "Unable to complete checkout", status: 400 };
}

export async function POST(request: Request) {
  try {
    const requestCookies = await cookies();
    const cartId = requestCookies.get("cart_id")?.value;
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!cartId) return NextResponse.json({ error: "Cart not found" }, { status: 400 });
    if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    if (idempotencyKey.length > 255) return NextResponse.json({ error: "Idempotency-Key is too long" }, { status: 400 });

    const body = await request.json() as Record<string, unknown>;
    const email = validateEmail(body.email);
    const firstName = assertLength(normalizeSingleLine(body.firstName), "name");
    const lastName = assertLength(normalizeSingleLine(body.lastName), "name");
    const phone = validatePhone(String(body.phone ?? ""));
    const shippingMethod = normalizeSingleLine(body.shippingMethod);
    if (shippingMethod !== "PICKUP" && shippingMethod !== "DELIVERY") throw new Error("INVALID_SHIPPING_METHOD");

    const promotionCode = body.promotionCode === undefined || body.promotionCode === null
      ? undefined
      : normalizeSingleLine(body.promotionCode).toUpperCase();
    if (promotionCode !== undefined && !/^[A-Z0-9_-]{3,64}$/u.test(promotionCode)) throw new Error("INVALID_PROMOTIONCODE");

    const rawAddress = body.shippingAddress;
    if (!rawAddress || typeof rawAddress !== "object" || Array.isArray(rawAddress)) throw new Error("INVALID_ADDRESSLINE");
    const address = rawAddress as Record<string, unknown>;
    const shippingPhone = validatePhone(String(address.phone ?? phone));
    const shippingAddress = {
      recipientName: assertLength(normalizeSingleLine(address.recipientName ?? `${firstName} ${lastName}`), "name"),
      phone: shippingPhone,
      addressLine1: assertLength(normalizeSingleLine(address.addressLine1), "addressLine"),
      ...(normalizeSingleLine(address.addressLine2) ? { addressLine2: assertLength(normalizeSingleLine(address.addressLine2), "addressLine") } : {}),
      city: assertLength(normalizeSingleLine(address.city), "city"),
      state: assertLength(normalizeSingleLine(address.state), "state"),
      ...(normalizeSingleLine(address.postalCode) ? { postalCode: assertLength(normalizeSingleLine(address.postalCode), "postalCode") } : {}),
      countryCode: normalizeSingleLine(address.countryCode || "CO").toUpperCase(),
    };

    const context = await commerceContext();
    const requestedEmail = email;
    const existingCustomer = await context.customerRepository.findByEmail(requestedEmail);
    const currentToken = requestCookies.get("customer_session")?.value;
    const currentSession = currentToken ? await context.customerSession.resolve(currentToken) : null;

    if (existingCustomer && (!currentSession || currentSession.customerId !== existingCustomer.getId())) return NextResponse.json({ error: "Customer session required" }, { status: 401 });
    if (currentSession) {
      const sessionCustomer = await context.customerRepository.findById(currentSession.customerId);
      if (!sessionCustomer || sessionCustomer.getId() !== existingCustomer?.getId()) return NextResponse.json({ error: "Customer session does not match checkout identity" }, { status: 401 });
    }

    const customerResult = await context.customer.save({ email: requestedEmail, firstName, lastName, phone }, { label: "Principal", ...shippingAddress, isDefault: true });
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
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
