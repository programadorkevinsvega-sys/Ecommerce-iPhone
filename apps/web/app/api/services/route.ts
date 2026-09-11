import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serviceCustomerPortal } from "../../../lib/services";

const last4 = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
};

export async function GET() {
  try {
    const customerId = (await cookies()).get("customer_id")?.value;
    return NextResponse.json(await serviceCustomerPortal().list(customerId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load services" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const customerId = (await cookies()).get("customer_id")?.value;
    const type = String(body.type ?? "").trim().toUpperCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const carrier = body.carrier ? String(body.carrier).trim() : undefined;
    const deviceSerialLast4 = last4(body.serial);
    const imeiLast4 = last4(body.imei);
    if (!email || !type) return NextResponse.json({ error: "email and type are required" }, { status: 400 });
    if (type === "CARRIER_UNLOCK" && !carrier) return NextResponse.json({ error: "Carrier is required" }, { status: 400 });

    const result = await serviceCustomerPortal().create({
      id: crypto.randomUUID(),
      ...(customerId ? { customerId } : {}),
      email,
      type,
      deviceBrand: String(body.deviceBrand ?? "").trim(),
      deviceModel: String(body.deviceModel ?? "").trim(),
      ...(deviceSerialLast4 ? { deviceSerialLast4 } : {}),
      ...(imeiLast4 ? { imeiLast4 } : {}),
      ...(carrier ? { carrier } : {}),
      problemDescription: String(body.problemDescription ?? "").trim(),
      ...(body.customerNotes ? { customerNotes: String(body.customerNotes).trim() } : {}),
      currency: "COP",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid service request" }, { status: 400 });
  }
}
