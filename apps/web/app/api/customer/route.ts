import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AddressProps, CustomerProps } from "../../../../../modules/customers/domain/Customer";
import { commerceContext } from "../../../lib/commerce";

type Input = Readonly<Record<string, unknown>>;

function asRecord(value: unknown): Input | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Input
    : undefined;
}

function requiredString(input: Input, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`INVALID_${key.toUpperCase()}`);
  return value.trim();
}

function optionalString(input: Input, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("customer_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
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

    return NextResponse.json(
      { customer: result.customer.toPrimitives(), addresses: result.addresses },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No pudimos completar la operación." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const parsed = asRecord(await request.json());
    if (!parsed) return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });

    const email = requiredString(parsed, "email").toLowerCase();
    const firstName = requiredString(parsed, "firstName");
    const lastName = requiredString(parsed, "lastName");
    const phone = optionalString(parsed, "phone");

    const addressInput = asRecord(parsed.address);
    const address: AddressProps | undefined = addressInput
      ? {
          label: requiredString(addressInput, "label"),
          recipientName: requiredString(addressInput, "recipientName"),
          phone: requiredString(addressInput, "phone"),
          addressLine1: requiredString(addressInput, "addressLine1"),
          ...(optionalString(addressInput, "addressLine2") ? { addressLine2: optionalString(addressInput, "addressLine2") } : {}),
          city: requiredString(addressInput, "city"),
          state: requiredString(addressInput, "state"),
          ...(optionalString(addressInput, "postalCode") ? { postalCode: optionalString(addressInput, "postalCode") } : {}),
          countryCode: requiredString(addressInput, "countryCode").toUpperCase(),
          isDefault: addressInput.isDefault === undefined ? true : addressInput.isDefault === true,
        }
      : undefined;

    const context = await commerceContext();
    const existing = await context.customerRepository.findByEmail(email);
    const currentToken = (await cookies()).get("customer_session")?.value;
    const currentSession = currentToken ? await context.customerSession.resolve(currentToken) : null;

    if (existing && (!currentSession || currentSession.customerId !== existing.getId())) {
      return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    }
    if (currentSession && currentSession.customerId !== existing?.getId()) {
      return NextResponse.json({ error: "Tu sesión ya no es válida. Inicia sesión nuevamente." }, { status: 401 });
    }

    const customer: CustomerProps = {
      email,
      firstName,
      lastName,
      ...(phone ? { phone } : {}),
    };

    const result = await context.customer.save(customer, address);
    const response = NextResponse.json(
      { customer: result.customer.toPrimitives(), addresses: result.addresses },
      { status: 201 },
    );

    if (!currentSession) {
      const newSession = await context.customerSession.create(result.customer.getId());
      setSessionCookie(response, newSession.token);
    }

    response.cookies.set("customer_id", "", { httpOnly: true, maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message.toUpperCase() : "UNKNOWN";
    const status =
      code.includes("UNAUTHORIZED") || code.includes("SESSION") ? 401 :
      code.includes("FORBIDDEN") ? 403 :
      code.includes("CONFLICT") || code.includes("ALREADY") ? 409 :
      code.includes("INVALID") || code.includes("VALIDATION") ? 422 : 500;
    const message =
      status === 401 ? "Tu sesión ya no es válida. Inicia sesión nuevamente." :
      status === 403 ? "No tienes autorización para realizar esta operación." :
      status === 409 ? "La operación entra en conflicto con el estado actual." :
      status === 422 ? "Revisa los datos ingresados e inténtalo nuevamente." :
      "No pudimos completar la operación.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
