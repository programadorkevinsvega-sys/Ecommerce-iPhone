import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkoutUseCase, commerceContext } from "../../../lib/commerce";
import { publishNotificationEvent } from "../../../lib/notifications";

export async function POST(request: Request) {
  try {
    const requestCookies = await cookies();
    const cartId = requestCookies.get("cart_id")?.value;
    if (!cartId) return NextResponse.json({ error: "Cart not found" }, { status: 400 });

    const body = (await request.json()) as Record<string, any>;
    for (const key of ["email", "firstName", "lastName", "phone", "shippingAddress", "shippingMethod"]) {
      if (!body[key]) return NextResponse.json({ error: `${key} is required` }, { status: 400 });
    }

    const address = body.shippingAddress;
    const shippingAddress = {
      recipientName: String(address.recipientName ?? `${body.firstName} ${body.lastName}`).trim(),
      phone: String(address.phone ?? body.phone).trim(),
      addressLine1: String(address.addressLine1 ?? "").trim(),
      ...(address.addressLine2 ? { addressLine2: String(address.addressLine2).trim() } : {}),
      city: String(address.city ?? "").trim(),
      state: String(address.state ?? "").trim(),
      ...(address.postalCode ? { postalCode: String(address.postalCode).trim() } : {}),
      countryCode: String(address.countryCode ?? "CO").toUpperCase(),
    };
    if (!shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.state) {
      return NextResponse.json({ error: "Complete shipping address is required" }, { status: 400 });
    }

    const context = await commerceContext();
    const requestedEmail = String(body.email).trim().toLowerCase();
    const existingCustomer = await context.customerRepository.findByEmail(requestedEmail);
    const currentToken = requestCookies.get("customer_session")?.value;
    const currentSession = currentToken ? await context.customerSession.resolve(currentToken) : null;

    if (existingCustomer && (!currentSession || currentSession.customerId !== existingCustomer.getId())) {
      return NextResponse.json({ error: "Customer session required" }, { status: 401 });
    }

    if (currentSession) {
      const sessionCustomer = await context.customerRepository.findById(currentSession.customerId);
      if (!sessionCustomer || sessionCustomer.getId() !== existingCustomer?.getId()) {
        return NextResponse.json({ error: "Customer session does not match checkout identity" }, { status: 401 });
      }
    }

    const customerResult = await context.customer.save(
      {
        email: requestedEmail,
        firstName: String(body.firstName).trim(),
        lastName: String(body.lastName).trim(),
        phone: String(body.phone).trim(),
      },
      { label: "Principal", ...shippingAddress, isDefault: true },
    );

    const cart = await context.cart.get(cartId);
    const { checkout } = await checkoutUseCase();
    const order = await checkout.execute(cart, {
      email: customerResult.customer.toPrimitives().email,
      shippingAddress,
      shippingMethod: String(body.shippingMethod) as "PICKUP" | "DELIVERY",
      customerId: customerResult.customer.getId(),
    });

    await publishNotificationEvent({
      eventType: "OrderCreated",
      aggregateId: order.id,
      payload: {
        email: customerResult.customer.toPrimitives().email,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalInCents: order.totalInCents,
        currency: order.currency,
      },
    });

    const newSession = await context.customerSession.create(customerResult.customer.getId());
    if (currentToken) await context.customerSession.revoke(currentToken);

    const response = NextResponse.json({ order }, { status: 201 });
    response.cookies.set("customer_session", newSession.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set("customer_id", "", { httpOnly: true, maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 400 });
  }
}
