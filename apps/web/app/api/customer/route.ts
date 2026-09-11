import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../lib/commerce";

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("customer_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function GET() {
  try {
    const token = (await cookies()).get("customer_session")?.value;
    if (!token) return NextResponse.json({ customer: null });
    const context = await commerceContext();
    const session = await context.customerSession.resolve(token);
    if (!session) return NextResponse.json({ customer: null });
    const result = await context.customer.get(session.customerId);
    if (!result.customer) return NextResponse.json({ customer: null });
    return NextResponse.json({ customer: result.customer.toPrimitives(), addresses: result.addresses });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load customer" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, any>;
    const context = await commerceContext();
    const email = String(body.email).trim().toLowerCase();
    const existing = await context.customerRepository.findByEmail(email);
    const currentToken = (await cookies()).get("customer_session")?.value;
    const currentSession = currentToken ? await context.customerSession.resolve(currentToken) : null;

    if (existing && (!currentSession || currentSession.customerId !== existing.getId())) return NextResponse.json({ error: "Customer session required" }, { status: 401 });
    if (currentSession && currentSession.customerId !== existing?.getId()) return NextResponse.json({ error: "Customer session does not match customer" }, { status: 401 });

    const address = body.address ? {
      label: String(body.address.label ?? "Principal"),
      recipientName: String(body.address.recipientName ?? `${body.firstName} ${body.lastName}`),
      phone: String(body.address.phone ?? body.phone ?? ""),
      addressLine1: String(body.address.addressLine1 ?? ""),
      ...(body.address.addressLine2 ? { addressLine2: String(body.address.addressLine2) } : {}),
      city: String(body.address.city ?? ""),
      state: String(body.address.state ?? ""),
      ...(body.address.postalCode ? { postalCode: String(body.address.postalCode) } : {}),
      countryCode: String(body.address.countryCode ?? "CO").toUpperCase(),
      isDefault: Boolean(body.address.isDefault ?? true),
    } : undefined;

    const result = await context.customer.save(
      { email, firstName: String(body.firstName).trim(), lastName: String(body.lastName).trim(), ...(body.phone ? { phone: String(body.phone).trim() } : {}) },
      address,
    );

    const response = NextResponse.json({ customer: result.customer.toPrimitives(), addresses: result.addresses }, { status: 201 });
    if (!currentSession) {
      const newSession = await context.customerSession.create(result.customer.getId());
      setSessionCookie(response, newSession.token);
    }
    response.cookies.set("customer_id", "", { httpOnly: true, maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save customer";
    return NextResponse.json({ error: message }, { status: message === "Customer session required" ? 401 : 400 });
  }
}
