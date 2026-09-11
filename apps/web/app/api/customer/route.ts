import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../lib/commerce";

function setCustomerCookie(response: NextResponse, id: string) {
  response.cookies.set("customer_id", id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

export async function GET() {
  try {
    const id = (await cookies()).get("customer_id")?.value;
    if (!id) return NextResponse.json({ customer: null });
    const { customer } = await commerceContext();
    const result = await customer.get(id);
    if (!result.customer) return NextResponse.json({ customer: null });
    return NextResponse.json({ customer: result.customer.toPrimitives(), addresses: result.addresses });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load customer" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, any>;
    const { customer } = await commerceContext();
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
    const result = await customer.save({ email: String(body.email).trim().toLowerCase(), firstName: String(body.firstName).trim(), lastName: String(body.lastName).trim(), ...(body.phone ? { phone: String(body.phone).trim() } : {}) }, address);
    const response = NextResponse.json({ customer: result.customer.toPrimitives(), addresses: result.addresses }, { status: 201 });
    setCustomerCookie(response, result.customer.getId());
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save customer" }, { status: 400 });
  }
}
