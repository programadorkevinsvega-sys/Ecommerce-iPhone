import { NextResponse } from "next/server";
import { requireAdmin, PERMISSIONS } from "../../../../../../lib/adminAuth";
import { paymentContext } from "../../../../../../lib/payments";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(PERMISSIONS.refundsCreate);
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 255) return NextResponse.json({ error: "A valid Idempotency-Key header is required" }, { status: 400 });
    const { id } = await context.params;
    if (!id || id.length > 128) return NextResponse.json({ error: "Invalid payment id" }, { status: 400 });
    const body = await request.json().catch(() => ({})) as { amountInCents?: unknown };
    if (body.amountInCents !== undefined) return NextResponse.json({ error: "Only full refunds are supported by this endpoint" }, { status: 400 });
    const payments = await paymentContext();
    const payment = await payments.service.refundPayment(id, idempotencyKey);
    return NextResponse.json({ payment }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : message === "Payment not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
