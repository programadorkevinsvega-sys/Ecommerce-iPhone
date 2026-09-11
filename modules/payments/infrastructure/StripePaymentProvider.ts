import type { CreatePaymentInput, PaymentProviderPort, ProviderPaymentIntent, ProviderTransaction } from "../application/PaymentPorts";
import type { Payment } from "../domain/Payment";

const STRIPE_API = "https://api.stripe.com/v1";

function form(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

export class StripePaymentProvider implements PaymentProviderPort {
  readonly provider = "STRIPE" as const;

  constructor(private readonly secretKey: string, private readonly publishableKey: string, private readonly appUrl: string) {}

  async createPaymentIntent(input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/payment_intents`, {
      method: "POST",
      headers: this.headers(input.idempotencyKey),
      body: form({
        amount: String(input.amountInCents),
        currency: input.currency.toLowerCase(),
        "automatic_payment_methods[enabled]": "true",
        "metadata[order_id]": input.orderId,
        "metadata[customer_id]": input.customerId,
        receipt_email: input.customerEmail,
        description: `Order ${input.orderId}`,
      }),
    });
    const body = await this.jsonOrError(response, "Stripe PaymentIntent creation failed");
    return this.intent(body, input);
  }

  async recoverPaymentIntent(payment: Payment, input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/payment_intents/${encodeURIComponent(payment.providerReference)}`, { headers: this.headers() });
    const body = await this.jsonOrError(response, "Stripe PaymentIntent recovery failed");
    if (body.metadata?.order_id !== input.orderId || body.amount !== input.amountInCents || String(body.currency).toLowerCase() !== input.currency.toLowerCase()) throw new Error("Recovered Stripe PaymentIntent does not match order");
    return this.intent(body, input);
  }

  async getTransaction(transactionId: string): Promise<ProviderTransaction> {
    this.requireConfigured();
    const response = await fetch(`${STRIPE_API}/payment_intents/${encodeURIComponent(transactionId)}`, { headers: this.headers() });
    const body = await this.jsonOrError(response, "Stripe PaymentIntent lookup failed");
    const status = body.status;
    const mapped = status === "succeeded" ? "APPROVED" : ["canceled"].includes(status) ? "VOIDED" : ["requires_payment_method"].includes(status) ? "DECLINED" : ["requires_action", "requires_confirmation", "requires_capture", "processing"].includes(status) ? "PENDING" : "ERROR";
    if (!body.id || !Number.isSafeInteger(body.amount) || typeof body.currency !== "string" || !body.metadata?.order_id) throw new Error("Stripe returned an invalid PaymentIntent");
    return { transactionId: body.id, reference: body.metadata.order_id, status: mapped, amountInCents: body.amount, currency: body.currency.toUpperCase() };
  }

  private intent(body: Record<string, any>, input: CreatePaymentInput): ProviderPaymentIntent {
    if (typeof body.id !== "string" || typeof body.client_secret !== "string" || body.amount !== input.amountInCents) throw new Error("Stripe returned an invalid PaymentIntent");
    return { providerReference: body.id, provider: this.provider, publicKey: this.publishableKey, currency: input.currency, amountInCents: input.amountInCents, integritySignature: "", checkoutUrl: `${this.appUrl.replace(/\/$/, "")}/payments/stripe`, clientSecret: body.client_secret };
  }

  private headers(idempotencyKey?: string): HeadersInit {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return headers;
  }

  private async jsonOrError(response: Response, message: string): Promise<Record<string, any>> {
    const body = await response.json().catch(() => null) as Record<string, any> | null;
    if (!response.ok || !body) throw new Error(`${message}: HTTP ${response.status}`);
    return body;
  }

  private requireConfigured(): void {
    if (!this.secretKey || !this.publishableKey) throw new Error("Stripe production credentials are not configured");
  }
}
