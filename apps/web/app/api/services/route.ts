import { NextResponse } from "next/server";
import { serviceCustomerPortal } from "../../../lib/services";
import {
  assertLength,
  normalizeMultiline,
  normalizeSingleLine,
  validateEmail,
  validatePhone,
} from "../../../lib/inputValidation";

const last4Digits = (value: unknown) => {
  const digits = normalizeSingleLine(value).replace(/\D/gu, "");
  if (!digits) return undefined;
  if (digits.length < 4 || digits.length > 20) throw new Error("INVALID_IMEI");
  return digits.slice(-4);
};

function safeError(error: unknown): string {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const known: Record<string, string> = {
    INVALID_EMAIL: "Invalid email",
    INVALID_PHONE: "Invalid phone",
    INVALID_COUNTRY: "Invalid country",
    INVALID_DEVICEBRAND: "Device brand is required",
    INVALID_DEVICEMODEL: "Device model is required",
    INVALID_CARRIER: "Carrier is required",
    INVALID_SERVICEDESCRIPTION: "Problem description is required and cannot exceed 3000 characters",
    INVALID_SERVICENOTES: "Additional notes cannot exceed 2000 characters",
    INVALID_IMEI: "Invalid IMEI",
    INVALID_SERIAL: "Invalid serial",
  };
  return known[code] ?? "Unable to process service request";
}

export async function GET() {
  try {
    // The service catalog is public. Customer accounts are not required for requests.
    const result = await serviceCustomerPortal().list();
    return NextResponse.json(result, {
      headers: { "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load services" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = assertLength(normalizeSingleLine(body.type).toUpperCase(), "serviceType");
    const email = validateEmail(body.email);
    const phone = validatePhone(body.phone);
    const whatsapp = validatePhone(body.whatsapp);
    const countryCode = normalizeSingleLine(body.countryCode).toUpperCase();
    if (!/^[A-Z]{2}$/u.test(countryCode)) throw new Error("INVALID_COUNTRY");
    const deviceBrand = assertLength(normalizeSingleLine(body.deviceBrand), "deviceBrand");
    const deviceModel = assertLength(normalizeSingleLine(body.deviceModel), "deviceModel");
    const carrier = normalizeSingleLine(body.carrier);
    const deviceSerialLast4 = body.serial
      ? assertLength(normalizeSingleLine(body.serial), "serial").slice(-4)
      : undefined;
    const imeiLast4 = body.imei ? last4Digits(body.imei) : undefined;
    const problemDescription = assertLength(
      normalizeMultiline(body.problemDescription),
      "serviceDescription",
    );
    const customerNotes = normalizeMultiline(body.customerNotes);
    if (customerNotes.length > 2000) throw new Error("INVALID_SERVICENOTES");
    if (type === "CARRIER_UNLOCK") assertLength(carrier, "carrier");

    const result = await serviceCustomerPortal().create({
      id: crypto.randomUUID(),
      email,
      phone,
      whatsapp,
      countryCode,
      type,
      deviceBrand,
      deviceModel,
      ...(deviceSerialLast4 ? { deviceSerialLast4 } : {}),
      ...(imeiLast4 ? { imeiLast4 } : {}),
      ...(carrier ? { carrier } : {}),
      problemDescription,
      ...(customerNotes ? { customerNotes } : {}),
      currency: "COP",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 400 });
  }
}
