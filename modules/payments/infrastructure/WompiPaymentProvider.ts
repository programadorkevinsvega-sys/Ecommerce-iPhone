import type { CreatePaymentInput, PaymentProviderPort, ProviderPaymentIntent, ProviderTransaction } from "../application/PaymentPorts";

const WOMPI_API = "https://production.wompi.co/v1";
const WOMPI_CHECKOUT = "https://checkout.wompi.co/p/";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class WompiPaymentProvider implements PaymentProviderPort {
  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string,
    private readonly integritySecret: string,
    private readonly appUrl: string,
  ) {}

  async createPaymentIntent(input: CreatePaymentInput): Promise<ProviderPaymentIntent> {
    this.requireConfigured();
    if (input.currency !== "COP") throw new Error("Wompi Colombia only supports COP for this integration");
    if (!Number.isSafeInteger(input.amountInCents) || input.amountInCents <= 0) throw new Error("Invalid payment amount");

    const providerReference = `EIP-${input.orderId.replaceAll("-", "").slice(0, 24)}-${input.idempotencyKey.replaceAll("-", "").slice(0, 24)}`.slice(0, 64);
    const signature = await sha256Hex(`${providerReference}${input.amountInCents}${input.currency}${this.integritySecret}`);
    const redirectUrl = `${this.appUrl.replace(/\/$/, "")}/orders/${encodeURIComponent(input.orderId)}`;
    const query = new URLSearchParams({
      "public-key": this.publicKey,
      currency: input.currency,
      "amount-in-cents": String(input.amountInCents),
      reference: providerReference,
      "signature:integrity": signature,
      "redirect-url": redirectUrl,
      "customer-data:email": input.customerEmail,
      "customer-data:full-name": input.customerName,
      "customer-data:phone-number": input.customerPhone,
      "shipping-address:address-line-1": input.shippingAddress.addressLine1,
      "shipping-address:address-line-2": input.shippingAddress.addressLine2 ?? "",
      "shipping-address:country": input.shippingAddress.countryCode,
      "shipping-address:city": input.shippingAddress.city,
      "shipping-address:phone-number": input.shippingAddress.phone,
      "shipping-address:region": input.shippingAddress.state,
    });

    return {
      providerReference,
      provider: "WOMPI",
      publicKey: this.publicKey,
      currency: input.currency,
      amountInCents: input.amountInCents,
      integritySignature: signature,
      checkoutUrl: `${WOMPI_CHECKOUT}?${query.toString()}`,
    };
  }

  async getTransaction(transactionId: string): Promise<ProviderTransaction> {
    this.requireConfigured();
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(transactionId)) throw new Error("Invalid provider transaction id");
    const response = await fetch(`${WOMPI_API}/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${this.privateKey}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Wompi transaction lookup failed with HTTP ${response.status}`);
    const body = await response.json() as { data?: { id?: string; reference?: string; status?: string; amount_in_cents?: number; currency?: string } };
    const data = body.data;
    if (!data?.id || !data.reference || !data.status || !Number.isSafeInteger(data.amount_in_cents) || !data.currency) {
      throw new Error("Wompi returned an invalid transaction payload");
    }
    if (!["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"].includes(data.status)) throw new Error("Unknown Wompi transaction status");
    return {
      transactionId: data.id,
      reference: data.reference,
      status: data.status as ProviderTransaction["status"],
      amountInCents: data.amount_in_cents,
      currency: data.currency,
    };
  }

  private requireConfigured(): void {
    if (!this.publicKey || !this.privateKey || !this.integritySecret) throw new Error("Wompi production credentials are not configured");
  }
}
