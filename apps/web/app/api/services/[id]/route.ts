import { NextResponse } from "next/server";
import { currentCustomerId } from "../../../../lib/customerSession";
import { serviceCustomerPortal } from "../../../../lib/services";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const customerId = await currentCustomerId();
    if (!customerId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await context.params;
    return NextResponse.json({ request: await serviceCustomerPortal().getOwned(id, customerId) });
  } catch (error) {
    const status = error instanceof Error && error.message === "Service request not found" ? 404 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load service request" }, { status });
  }
}
