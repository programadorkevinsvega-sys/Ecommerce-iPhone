import { NextResponse } from "next/server";
import { CustomerAddressService } from "../../../../../../../modules/customers/application/CustomerAddressService";
import { authenticatedCustomer } from "../../../../../lib/customerAccount";
import { recordCustomerSecurityEvent } from "../../../../../lib/customerSecurity";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await authenticatedCustomer();
  if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const { id } = await context.params;
    const input = await request.json() as Record<string, unknown>;
    const address = await new CustomerAddressService(current.context.customerRepository).update(current.session.customerId, id, input);
    await recordCustomerSecurityEvent(current.context.customerSecurityAudit, request, "PROFILE_UPDATED", current.session.customerId, { resource: "address", action: "updated" });
    return NextResponse.json({ address }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "ADDRESS_NOT_FOUND" ? "Dirección no encontrada." : "Revisa los datos de la dirección." }, { status: code === "ADDRESS_NOT_FOUND" ? 404 : 422, headers: { "cache-control": "no-store" } });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await authenticatedCustomer();
  if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const { id } = await context.params;
    await new CustomerAddressService(current.context.customerRepository).remove(current.session.customerId, id);
    await recordCustomerSecurityEvent(current.context.customerSecurityAudit, request, "PROFILE_UPDATED", current.session.customerId, { resource: "address", action: "deleted" });
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "ADDRESS_NOT_FOUND" ? "Dirección no encontrada." : "No pudimos eliminar la dirección." }, { status: code === "ADDRESS_NOT_FOUND" ? 404 : 422, headers: { "cache-control": "no-store" } });
  }
}
