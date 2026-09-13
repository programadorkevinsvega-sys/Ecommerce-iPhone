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
    return NextResponse.json({ customer: result.customer.toPrimitives(), addresses: result.addresses }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la operación." }, { status: 500, headers: { "cache-control": "no-store" } });
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

    if (existing && (!currentSession || currentSession.customerId !== existing.getId())) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    if (currentSession && currentSession.customerId !== existing?.getId()) return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });

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
    const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
    const status = code.includes("UNAUTHORIZED") || code.includes("SESSION") ? 401 : code.includes("FORBIDDEN") ? 403 : code.includes("CONFLICT") || code.includes("ALREADY") ? 409 : code.includes("INVALID") || code.includes("VALIDATION") ? 422 : 500;
    const message = status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente." : status === 403 ? "No tienes autorización para realizar esta operación." : status === 409 ? "La operación entra en conflicto con el estado actual." : status === 422 ? "Revisa los datos ingresados e inténtalo nuevamente." : "No pudimos completar la operación.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
