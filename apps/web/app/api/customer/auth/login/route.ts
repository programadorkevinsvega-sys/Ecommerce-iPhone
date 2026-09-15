import { NextResponse } from "next/server";
import { CustomerAccountService } from "../../../../../../../modules/customers/application/CustomerAccountService";
import { commerceContext } from "../../../../../lib/commerce";
import { recordCustomerSecurityEvent } from "../../../../../lib/customerSecurity";

export async function POST(request: Request) {
  const context = await commerceContext();
  try {
    const input = await request.json() as Record<string, unknown>;
    const service = new CustomerAccountService(context.customerRepository);
    const customer = await service.authenticate(input);
    if (!customer) {
      await recordCustomerSecurityEvent(context.customerSecurityAudit, request, "LOGIN_FAILED", null);
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    const session = await context.customerSession.create(customer.id);
    await recordCustomerSecurityEvent(context.customerSecurityAudit, request, "LOGIN_SUCCEEDED", customer.id);
    const response = NextResponse.json({ customer }, { headers: { "cache-control": "no-store" } });
    response.cookies.set("customer_session", session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    await recordCustomerSecurityEvent(context.customerSecurityAudit, request, "LOGIN_FAILED", null);
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
}
