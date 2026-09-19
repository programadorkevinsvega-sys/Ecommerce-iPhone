import { NextResponse } from "next/server";
import { authenticatedCustomer } from "../../../../lib/customerAccount";

function input(body: Record<string, unknown>) {
  const text = (key: string, max: number) => {
    const value = String(body[key] ?? "").replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim();
    return value.slice(0, max) || null;
  };
  const deviceType = String(body.deviceType ?? "PHONE").trim().toUpperCase();
  const brand = text("brand", 60);
  const model = text("model", 100);
  if (!brand || !model) throw new Error("INVALID_DEVICE");
  return { deviceType, brand, model, serialLast4: text("serialLast4", 4), imeiLast4: text("imeiLast4", 4), color: text("color", 60), capacity: text("capacity", 40), physicalCondition: text("physicalCondition", 1000), notes: text("notes", 1000) };
}

export async function GET() {
  const current = await authenticatedCustomer();
  if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const devices = await current.context.customerDevices.list(current.session.customerId);
  return NextResponse.json({ devices: devices.map(device => device.toPrimitives()) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const current = await authenticatedCustomer();
    if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    const device = await current.context.customerDevices.create(current.session.customerId, input(await request.json() as Record<string, unknown>));
    return NextResponse.json({ device: device.toPrimitives() }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Revisa los datos ingresados e inténtalo nuevamente." }, { status: 422 });
  }
}
