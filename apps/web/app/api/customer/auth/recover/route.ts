import { NextResponse } from "next/server";
import { CustomerAccountService } from "../../../../../../../modules/customers/application/CustomerAccountService";
import { commerceContext } from "../../../../../lib/commerce";
import { recordCustomerSecurityEvent } from "../../../../../lib/customerSecurity";
import { publishNotificationEvent } from "../../../../../lib/notifications";

export async function POST(request: Request) {
  const context = await commerceContext();
  try {
    const input = await request.json() as Record<string, unknown>;
    const reset = await new CustomerAccountService(context.customerRepository).requestPasswordReset(input);
    await recordCustomerSecurityEvent(
      context.customerSecurityAudit,
      request,
      "PASSWORD_RESET_REQUESTED",
      null,
    );
    if (reset) {
      const origin = new URL(request.url).origin;
      await publishNotificationEvent({
        id: crypto.randomUUID(),
        eventType: "CustomerPasswordResetRequested",
        aggregateId: reset.email,
        payload: {
          email: reset.email,
          resetUrl: `${origin}/cuenta/recuperar?token=${encodeURIComponent(reset.token)}`,
          expiresInMinutes: 30,
        },
      });
    }
  } catch {
    // Recovery intentionally keeps the same public response for existent/non-existent accounts.
  }
  return NextResponse.json(
    { message: "Si la cuenta existe, recibirás instrucciones para recuperar el acceso." },
    { headers: { "cache-control": "no-store" } },
  );
}
