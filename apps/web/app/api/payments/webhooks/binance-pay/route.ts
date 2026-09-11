import { NextResponse } from "next/server";
import { paymentContext } from "../../../../../../lib/payments";
import { verifyBinancePayWebhook } from "../../../../../../../modules/payments/infrastructure/BinancePayWebhookVerifier";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("Invalid Binance Pay webhook payload");
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const { env, service, providers } = await paymentContext();
    await verifyBinancePayWebhook(env.BINANCE_PAY_SECRET_KEY ?? "", raw, request.headers.get("BinancePay-Timestamp"), request.headers.get("BinancePay-Nonce"), request.headers.get("BinancePay-Certificate-SN"), request.headers.get("BinancePay-Signature"));
    if (request.headers.get("BinancePay-Certificate-SN") !== env.BINANCE_PAY_CERTIFICATE_SN) throw new Error("Binance Pay certificate mismatch");
    const payload = record(JSON.parse(raw));
    if (payload.bizType && payload.bizType !== "PAY") return NextResponse.json({ received: true });
    const prepayId = typeof payload.prepayId === "string" ? payload.prepayId : null;
    const transactionId = typeof payload.transactionId === "string" ? payload.transactionId : null;
    if (!prepayId && !transactionId) throw new Error("Binance Pay transaction identifier is missing");
    const transaction = await providers.resolve("BINANCE_PAY").getTransaction(prepayId ?? transactionId!);
    await service.processProviderTransaction(transaction, raw);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }
}
