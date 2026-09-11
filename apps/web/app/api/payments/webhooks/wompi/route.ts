import { NextResponse } from "next/server";
import { paymentContext } from "../../../../../lib/payments";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function transactionFromEvent(event: unknown): { id: string; reference: string; status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR"; amount_in_cents: number; currency: string } {
  if (!isRecord(event) || !isRecord(event.data) || !isRecord(event.data.transaction)) throw new Error("Wompi transaction payload is missing");
  const transaction = event.data.transaction;
  const id = transaction.id, reference = transaction.reference, status = transaction.status, amount = transaction.amount_in_cents, currency = transaction.currency;
  if (typeof id !== "string" || typeof reference !== "string" || typeof status !== "string" || typeof amount !== "number" || typeof currency !== "string") throw new Error("Invalid Wompi transaction payload");
  if (!["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"].includes(status)) throw new Error("Unsupported Wompi transaction status");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid Wompi transaction amount");
  return { id, reference, status: status as "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR", amount_in_cents: amount, currency };
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const { env, service, verifyWompiWebhook } = await paymentContext();
    const event = await verifyWompiWebhook(raw, env.WOMPI_EVENTS_SECRET ?? "", request.headers.get("X-Event-Checksum"));
    const transaction = transactionFromEvent(event);
    await service.processProviderTransaction({ provider: "WOMPI", transactionId: transaction.id, reference: transaction.reference, status: transaction.status, amountInCents: transaction.amount_in_cents, currency: transaction.currency }, raw);
    return NextResponse.json({ received: true }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook";
    return NextResponse.json({ error: message }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
