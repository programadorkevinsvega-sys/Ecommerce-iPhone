import type { CreatePaymentInput, PaymentProviderPort, ProviderPaymentIntent, ProviderRefund, ProviderTransaction } from "../application/PaymentPorts";
import type { Payment } from "../domain/Payment";

const STRIPE_API = "https://api.stripe.com/v1";
type StripeRecord = Record<string, unknown>;
function form(values: Record<string, string>): string { return new URLSearchParams(values).toString(); }
function record(value: unknown): StripeRecord { if (!value || typeof value !== "object") throw new Error("Stripe returned an invalid payload"); return value as StripeRecord; }

export class StripePaymentProvider implements PaymentProviderPort {
  readonly provider = "STRIPE" as const;
  constructor(private readonly secretKey: string, private readonly publishableKey: string, private readonly appUrl: string) {}
  async createPaymentIntent(input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/payment_intents`, { method: "POST", headers: this.headers(input.idempotencyKey), body: form({ amount: String(input.amountInCents), currency: input.currency.toLowerCase(), "automatic_payment_methods[enabled]": "true", "metadata[order_id]": input.orderId, "metadata[customer_id]": input.customerId, receipt_email: input.customerEmail, description: `Order ${input.orderId}` }) });
    return this.intent(await this.jsonOrError(response, "Stripe PaymentIntent creation failed"), input);
  }
  async recoverPaymentIntent(payment: Payment, input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/payment_intents/${encodeURIComponent(payment.providerReference)}`, { headers: this.headers() });
    const body = await this.jsonOrError(response, "Stripe PaymentIntent recovery failed");
    const metadata = record(body.metadata);
    if (metadata.order_id !== input.orderId || metadata.customer_id !== input.customerId || body.amount !== input.amountInCents || String(body.currency).toLowerCase() !== input.currency.toLowerCase()) throw new Error("Recovered Stripe PaymentIntent does not match order");
    return this.intent(body, input);
  }
  async getTransaction(transactionId: string): Promise<ProviderTransaction> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/payment_intents/${encodeURIComponent(transactionId)}`, { headers: this.headers() });
    const body = await this.jsonOrError(response, "Stripe PaymentIntent lookup failed");
    const status = typeof body.status === "string" ? body.status : "";
    const mapped: ProviderTransaction["status"] = status === "succeeded" ? "APPROVED" : status === "canceled" ? "VOIDED" : status === "requires_payment_method" ? "DECLINED" : ["requires_action", "requires_confirmation", "requires_capture", "processing"].includes(status) ? "PENDING" : "ERROR";
    const metadata = record(body.metadata);
    const amount = body.amount;
    const id = body.id;
    const currency = body.currency;
    if (typeof id !== "string" || typeof amount !== "number" || !Number.isSafeInteger(amount) || typeof currency !== "string" || typeof metadata.order_id !== "string") throw new Error("Stripe returned an invalid PaymentIntent");
    return { provider: this.provider, transactionId: id, reference: id, status: mapped, amountInCents: amount, currency: currency.toUpperCase() };
  }
  async refundPayment(transactionId: string, amountInCents: number, idempotencyKey: string): Promise<ProviderRefund> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/refunds`, { method: "POST", headers: this.headers(idempotencyKey), body: form({ payment_intent: transactionId, amount: String(amountInCents) }) });
    const body = await this.jsonOrError(response, "Stripe refund failed");
    if (typeof body.id !== "string" || typeof body.amount !== "number" || typeof body.currency !== "string") throw new Error("Stripe returned an invalid refund");
    const status = body.status === "succeeded" ? "SUCCEEDED" : "PENDING";
    return { providerRefundId: body.id, status, amountInCents: body.amount, currency: body.currency.toUpperCase() };
  }
  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/refunds/${encodeURIComponent(providerRefundId)}`, { headers: this.headers() });
    const body = await this.jsonOrError(response, "Stripe refund lookup failed");
    if (typeof body.id !== "string" || typeof body.amount !== "number" || typeof body.currency !== "string") throw new Error("Stripe returned an invalid refund");
    return { providerRefundId: body.id, status: body.status === "succeeded" ? "SUCCEEDED" : "PENDING", amountInCents: body.amount, currency: body.currency.toUpperCase() };
  }
  private intent(body: StripeRecord, input: CreatePaymentInput): ProviderPaymentIntent {
    if (typeof body.id !== "string" || typeof body.client_secret !== "string" || body.amount !== input.amountInCents || String(body.currency).toLowerCase() !== input.currency.toLowerCase()) throw new Error("Stripe returned an invalid PaymentIntent");
    return { providerReference: body.id, provider: this.provider, publicKey: this.publishableKey, currency: input.currency, amountInCents: input.amountInCents, integritySignature: "", checkoutUrl: `${this.appUrl.replace(/\/$/, "")}/payments/stripe`, clientSecret: body.client_secret };
  }
  private headers(idempotencyKey?: string): HeadersInit { const headers: Record<string, string> = { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" }; if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey; return headers; }
  private async jsonOrError(response: Response, message: string): Promise<StripeRecord> { const body = await response.json().catch(() => null); if (!response.ok) throw new Error(`${message}: HTTP ${response.status}`); return record(body); }
  private requireConfigured(): void { if (!this.secretKey || !this.publishableKey) throw new Error("Stripe production credentials are not configured"); }
}
