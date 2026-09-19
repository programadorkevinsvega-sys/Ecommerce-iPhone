import { NextResponse } from "next/server";
import { authenticatedCustomer } from "../../../../../lib/customerAccount";

function input(body: Record<string, unknown>) {
  const text = (key: string, max: number) => String(body[key] ?? "").replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max) || null;
  const deviceType = String(body.deviceType ?? "PHONE").trim().toUpperCase();
  const brand = text("brand", 60);
  const model = text("model", 100);
  if (!brand || !model) throw new Error("INVALID_DEVICE");
  return { deviceType, brand, model, serialLast4: text("serialLast4", 4), imeiLast4: text("imeiLast4", 4), color: text("color", 60), capacity: text("capacity", 40), physicalCondition: text("physicalCondition", 1000), notes: text("notes", 1000) };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const current = await authenticatedCustomer();
    if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    const { id } = await params;
    const device = await current.context.customerDevices.update(current.session.customerId, id, input(await request.json() as Record<string, unknown>));
    if (!device) return NextResponse.json({ error: "No encontramos el dispositivo." }, { status: 404 });
    return NextResponse.json({ device: device.toPrimitives() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await authenticatedCustomer();
  if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const { id } = await params;
  const archived = await current.context.customerDevices.archive(current.session.customerId, id);
  return archived ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "No encontramos el dispositivo." }, { status: 404 });
}
