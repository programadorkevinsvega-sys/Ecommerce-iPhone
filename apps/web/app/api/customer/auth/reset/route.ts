import { NextResponse } from "next/server";
import { CustomerAccountService } from "../../../../../../../modules/customers/application/CustomerAccountService";
import { commerceContext } from "../../../../../lib/commerce";
import { recordCustomerSecurityEvent } from "../../../../../lib/customerSecurity";

export async function POST(request: Request) {
  const context = await commerceContext();
  try {
    const input = await request.json() as Record<string, unknown>;
    const customerId = await new CustomerAccountService(context.customerRepository).resetPassword(input);
    await recordCustomerSecurityEvent(
      context.customerSecurityAudit,
      request,
      "PASSWORD_RESET_COMPLETED",
      customerId,
    );
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "El enlace no es válido o ya expiró." },
      { status: 422, headers: { "cache-control": "no-store" } },
    );
  }
}
