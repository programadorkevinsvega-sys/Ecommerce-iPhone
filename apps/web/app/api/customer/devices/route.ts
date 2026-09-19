import { NextResponse } from "next/server";
import { authenticatedCustomer } from "../../../../lib/customerAccount";

export async function GET() {
  const current = await authenticatedCustomer();
  if (!current) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const devices = await current.context.customerDevices.list(current.session.customerId);
  return NextResponse.json({ devices: devices.map(device => device.toPrimitives()) }, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  return NextResponse.json({ error: "Los dispositivos se registran en el taller por personal autorizado." }, { status: 405, headers: { Allow: "GET" } });
}
