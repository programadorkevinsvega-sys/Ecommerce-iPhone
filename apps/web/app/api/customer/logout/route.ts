import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { commerceContext } from "../../../../../lib/commerce";

export async function POST() {
  const token = (await cookies()).get("customer_session")?.value;
  if (token) {
    const context = await commerceContext();
    await context.customerSession.revoke(token);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("customer_session", "", { httpOnly: true, maxAge: 0, path: "/" });
  response.cookies.set("customer_id", "", { httpOnly: true, maxAge: 0, path: "/" });
  return response;
}
