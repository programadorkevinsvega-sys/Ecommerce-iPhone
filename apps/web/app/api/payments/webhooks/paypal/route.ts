import { NextResponse } from "next/server";
import { paymentContext } from "../../../../../../lib/payments";
import { verifyPayPalWebhook } from "../../../../../../../modules/payments/infrastructure/PayPalWebhookVerifier";

async function accessToken(clientId: string, clientSecret: string): Promise<string> {
  if (!clientId || !clientSecret) throw new Error("PayPal production credentials are not configured");
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || typeof (body as Record<string, unknown>).access_token !== "string") throw new Error("PayPal OAuth failed");
  return (body as Record<string, unknown>).access_token as string;
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const { env, service, providers } = await paymentContext();
    const token = await accessToken(env.PAYPAL_CLIENT_ID ?? "", env.PAYPAL_CLIENT_SECRET ?? "");
    await verifyPayPalWebhook({ body: raw, webhookId: env.PAYPAL_WEBHOOK_ID ?? "", authAlgo: request.headers.get("PAYPAL-AUTH-ALGO"), certUrl: request.headers.get("PAYPAL-CERT-URL"), transmissionId: request.headers.get("PAYPAL-TRANSMISSION-ID"), transmissionSig: request.headers.get("PAYPAL-TRANSMISSION-SIG"), transmissionTime: request.headers.get("PAYPAL-TRANSMISSION-TIME") }, token);
    const event: unknown = JSON.parse(raw);
    if (!event || typeof event !== "object") throw new Error("Invalid PayPal webhook payload");
    const resource = (event as Record<string, unknown>).resource;
    const resourceRecord = resource && typeof resource === "object" ? resource as Record<string, unknown> : null;
    const id = typeof resourceRecord?.id === "string" ? resourceRecord.id : null;
    if (!id) throw new Error("PayPal order id is missing");
    const transaction = await providers.resolve("PAYPAL").getTransaction(id);
    await service.processProviderTransaction(transaction, raw);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }
}
