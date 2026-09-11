import type { CreatePaymentInput, PaymentProviderPort, ProviderPaymentIntent, ProviderTransaction } from "../application/PaymentPorts";
import type { Payment } from "../domain/Payment";

const MP_API = "https://api.mercadopago.com";

function majorAmount(minor: number, currency: string): string {
  const zeroDecimal = new Set(["COP", "CLP", "PYG", "ISK", "UGX", "VND"]);
  return zeroDecimal.has(currency.toUpperCase()) ? String(minor) : (minor / 100).toFixed(2);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("Mercado Pago returned an invalid payload");
  return value as Record<string, unknown>;
}

export class MercadoPagoPaymentProvider implements PaymentProviderPort {
  readonly provider = "MERCADOPAGO" as const;

  constructor(private readonly accessToken: string, private readonly appUrl: string) {}

  async createPaymentIntent(input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    this.requireConfigured();
    const response = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        external_reference: input.orderId,
        payer: { email: input.customerEmail, name: input.customerName, phone: { number: input.customerPhone } },
        items: [{ id: input.orderId, title: `Order ${input.orderId}`, quantity: 1, unit_price: Number(majorAmount(input.amountInCents, input.currency)), currency_id: input.currency }],
        back_urls: { success: `${this.appUrl}/orders/${encodeURIComponent(input.orderId)}`, failure: `${this.appUrl}/orders/${encodeURIComponent(input.orderId)}`, pending: `${this.appUrl}/orders/${encodeURIComponent(input.orderId)}` },
        auto_return: "approved",
      }),
    });
    const body = record(await response.json().catch(() => null));
    if (!response.ok || typeof body.id !== "string" || typeof body.init_point !== "string") throw new Error(`Mercado Pago preference creation failed: HTTP ${response.status}`);
    return { providerReference: body.id, provider: this.provider, publicKey: "", currency: input.currency, amountInCents: input.amountInCents, integritySignature: "", checkoutUrl: body.init_point };
  }

  async recoverPaymentIntent(payment: Payment, input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    this.requireConfigured();
    const response = await fetch(`${MP_API}/checkout/preferences/${encodeURIComponent(payment.providerReference)}`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    const body = record(await response.json().catch(() => null));
    if (!response.ok || body.external_reference !== input.orderId || typeof body.init_point !== "string") throw new Error("Mercado Pago preference recovery failed or does not match order");
    return { providerReference: payment.providerReference, provider: this.provider, publicKey: "", currency: input.currency, amountInCents: input.amountInCents, integritySignature: "", checkoutUrl: body.init_point };
  }

  async getTransaction(transactionId: string): Promise<ProviderTransaction> {
    this.requireConfigured();
    const response = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(transactionId)}`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    const body = record(await response.json().catch(() => null));
    if (!response.ok || typeof body.id !== "number" || typeof body.status !== "string" || typeof body.external_reference !== "string" || typeof body.transaction_amount !== "number" || typeof body.currency_id !== "string") throw new Error(`Mercado Pago payment lookup failed: HTTP ${response.status}`);
    const status = body.status === "approved" ? "APPROVED" : ["rejected", "cancelled", "refunded", "charged_back"].includes(body.status) ? "DECLINED" : ["pending", "in_process", "authorized"].includes(body.status) ? "PENDING" : "ERROR";
    return { transactionId: String(body.id), reference: body.external_reference, status, amountInCents: Math.round(body.transaction_amount * (new Set(["COP", "CLP", "PYG", "ISK", "UGX", "VND"]).has(body.currency_id) ? 1 : 100)), currency: body.currency_id };
  }

  private requireConfigured(): void {
    if (!this.accessToken) throw new Error("Mercado Pago production access token is not configured");
  }
}
