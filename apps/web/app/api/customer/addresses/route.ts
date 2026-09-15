import { NextResponse } from "next/server";
import { CustomerAddressService } from "../../../../../../modules/customers/application/CustomerAddressService";
import { authenticatedCustomer } from "../../../lib/customerAccount";
import { recordCustomerSecurityEvent } from "../../../lib/customerSecurity";

export async function GET() {
  const current = await authenticatedCustomer();
  if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  return NextResponse.json(
    { addresses: await new CustomerAddressService(current.context.customerRepository).list(current.session.customerId) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const current = await authenticatedCustomer();
  if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const address = await new CustomerAddressService(current.context.customerRepository).create(current.session.customerId, input);
    await recordCustomerSecurityEvent(current.context.customerSecurityAudit, request, "PROFILE_UPDATED", current.session.customerId, { resource: "address", action: "created" });
    return NextResponse.json({ address }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Revisa los datos de la dirección." }, { status: 422, headers: { "cache-control": "no-store" } });
  }
}
