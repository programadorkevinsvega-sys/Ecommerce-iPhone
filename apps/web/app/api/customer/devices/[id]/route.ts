import { NextResponse } from "next/server";
import { authenticatedCustomer } from "../../../../lib/customerAccount";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await authenticatedCustomer();
    if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

    const { id } = await context.params;
    if (!id || id.length > 128) {
      return NextResponse.json({ error: "Dispositivo no válido." }, { status: 422 });
    }

    const device = await current.context.customerDevices.get(current.session.customerId, id);
    if (!device) return NextResponse.json({ error: "No encontramos el dispositivo solicitado." }, { status: 404 });

    return NextResponse.json(
      { device: device.toPrimitives() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No pudimos completar la operación." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Los dispositivos se modifican por personal autorizado." },
    { status: 405, headers: { Allow: "GET" } },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Los dispositivos se archivan por personal autorizado." },
    { status: 405, headers: { Allow: "GET" } },
  );
}
