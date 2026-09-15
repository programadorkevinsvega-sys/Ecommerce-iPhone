import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../../lib/commerce";
import { recordCustomerSecurityEvent } from "../../../../lib/customerSecurity";

export async function POST(request: Request) {
  const token = (await cookies()).get("customer_session")?.value;
  const response = NextResponse.json({ ok: true });
  response.cookies.set("customer_session", "", { httpOnly: true, sameSite: "lax", secure: true, maxAge: 0, path: "/" });
  response.cookies.set("customer_id", "", { httpOnly: true, sameSite: "lax", secure: true, maxAge: 0, path: "/" });
  if (token) {
    const context = await commerceContext();
    const session = await context.customerSession.resolve(token);
    if (session) {
      await context.customerSession.revoke(token);
      await recordCustomerSecurityEvent(context.customerSecurityAudit, request, "LOGOUT", session.customerId);
    }
  }
  return response;
}
