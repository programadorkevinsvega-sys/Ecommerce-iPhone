import type { CreatePaymentInput, PaymentProviderPort, ProviderPaymentIntent, ProviderTransaction } from "../application/PaymentPorts";
import type { Payment } from "../domain/Payment";

const PAYPAL_API = "https://api-m.paypal.com";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("PayPal returned an invalid payload");
  return value as Record<string, unknown>;
}

export class PayPalPaymentProvider implements PaymentProviderPort {
  readonly provider = "PAYPAL" as const;

  constructor(private readonly clientId: string, private readonly clientSecret: string, private readonly appUrl: string) {}

  async createPaymentIntent(input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    const token = await this.accessToken();
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": input.idempotencyKey, Prefer: "return=representation" },
      body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: input.orderId, custom_id: input.idempotencyKey, amount: { currency_code: input.currency, value: this.major(input.amountInCents, input.currency) } }], application_context: { return_url: `${this.appUrl}/orders/${encodeURIComponent(input.orderId)}`, cancel_url: `${this.appUrl}/orders/${encodeURIComponent(input.orderId)}` } }),
    });
    const body = record(await response.json().catch(() => null));
    if (!response.ok || typeof body.id !== "string") throw new Error(`PayPal order creation failed: HTTP ${response.status}`);
    return this.intent(body, input);
  }

  async recoverPaymentIntent(payment: Payment, input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    const token = await this.accessToken();
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(payment.providerReference)}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = record(await response.json().catch(() => null));
    if (!response.ok) throw new Error(`PayPal order recovery failed: HTTP ${response.status}`);
    const purchase = Array.isArray(body.purchase_units) ? body.purchase_units[0] as Record<string, unknown> : null;
    const reference = purchase?.reference_id;
    if (reference !== input.orderId) throw new Error("PayPal order does not match order");
    return this.intent(body, input);
  }

  async getTransaction(transactionId: string): Promise<ProviderTransaction> {
    const token = await this.accessToken();
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(transactionId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = record(await response.json().catch(() => null));
    if (!response.ok || typeof body.id !== "string" || typeof body.status !== "string") throw new Error(`PayPal order lookup failed: HTTP ${response.status}`);
    const purchase = Array.isArray(body.purchase_units) ? body.purchase_units[0] as Record<string, unknown> : null;
    const amount = purchase?.amount && typeof purchase.amount === "object" ? purchase.amount as Record<string, unknown> : null;
    const currency = amount?.currency_code;
    const value = amount?.value;
    if (typeof purchase?.reference_id !== "string" || typeof currency !== "string" || typeof value !== "string") throw new Error("PayPal returned an incomplete order");
    const status = body.status === "COMPLETED" ? "APPROVED" : body.status === "CANCELED" ? "VOIDED" : body.status === "APPROVED" || body.status === "PAYER_ACTION_REQUIRED" || body.status === "CREATED" ? "PENDING" : "ERROR";
    return { transactionId: body.id, reference: purchase.reference_id, status, amountInCents: this.minor(value, currency), currency };
  }

  private intent(body: Record<string, unknown>, input: CreatePaymentInput): ProviderPaymentIntent {
    const id = body.id;
    const links = Array.isArray(body.links) ? body.links : [];
    const approve = links.find((item): item is Record<string, unknown> => !!item && typeof item === "object" && (item as Record<string, unknown>).rel === "payer-action" || (item as Record<string, unknown>).rel === "approve");
    const href = approve?.href;
    if (typeof id !== "string" || typeof href !== "string") throw new Error("PayPal did not return a payer approval URL");
    return { providerReference: id, provider: this.provider, publicKey: this.clientId, currency: input.currency, amountInCents: input.amountInCents, integritySignature: "", checkoutUrl: href };
  }

  private async accessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) throw new Error("PayPal production credentials are not configured");
    const basic = btoa(`${this.clientId}:${this.clientSecret}`);
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    const body = record(await response.json().catch(() => null));
    if (!response.ok || typeof body.access_token !== "string") throw new Error(`PayPal OAuth failed: HTTP ${response.status}`);
    return body.access_token;
  }

  private major(minor: number, currency: string): string {
    return new Set(["JPY", "KRW", "CLP", "VND", "COP"]).has(currency.toUpperCase()) ? String(minor) : (minor / 100).toFixed(2);
  }

  private minor(value: string, currency: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Invalid PayPal amount");
    return Math.round(parsed * (new Set(["JPY", "KRW", "CLP", "VND", "COP"]).has(currency.toUpperCase()) ? 1 : 100));
  }
}
