import { describe, expect, it } from "vitest";
import type { PaymentProvider } from "../../../modules/payments/domain/Payment";
import { validatePaymentRedirect } from "./paymentProviderConfig";

const origin = "https://ecommerce-iphone.example";

function expectValid(provider: PaymentProvider, url: string): void {
  expect(validatePaymentRedirect(provider, url, origin).toString()).toBe(url);
}

describe("validatePaymentRedirect", () => {
  it.each([
    ["WOMPI", "https://checkout.wompi.co/p/?public-key=pub_prod_x"],
    ["STRIPE", "https://checkout.stripe.com/c/pay/cs_live_x"],
    ["MERCADOPAGO", "https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=x"],
    ["PAYPAL", "https://www.paypal.com/checkoutnow?token=x"],
    ["BINANCE_PAY", "https://pay.binance.com/en/checkout/x"],
  ] as const)("accepts an HTTPS checkout URL for %s", (provider, url) => {
    expectValid(provider, url);
  });

  it("allows the controlled same-origin Stripe route", () => {
    expectValid("STRIPE", `${origin}/payments/stripe`);
  });

  it("rejects an unexpected hostname", () => {
    expect(() => validatePaymentRedirect("WOMPI", "https://evil.example/checkout", origin)).toThrow(/hostname/i);
  });

  it("rejects non-HTTPS external redirects", () => {
    expect(() => validatePaymentRedirect("PAYPAL", "http://www.paypal.com/checkoutnow?token=x", origin)).toThrow(/HTTPS/i);
  });

  it("rejects javascript URLs", () => {
    expect(() => validatePaymentRedirect("WOMPI", "javascript:alert(1)", origin)).toThrow(/payment redirect/i);
  });

  it("rejects credentials embedded in the redirect URL", () => {
    expect(() => validatePaymentRedirect("PAYPAL", "https://user:password@www.paypal.com/checkoutnow?token=x", origin)).toThrow(/payment redirect/i);
  });

  it("rejects arbitrary same-origin paths", () => {
    expect(() => validatePaymentRedirect("STRIPE", `${origin}/admin`, origin)).toThrow(/same-origin/i);
  });

  it("rejects a provider mismatch", () => {
    expect(() => validatePaymentRedirect("WOMPI", "https://www.paypal.com/checkoutnow?token=x", origin)).toThrow(/hostname/i);
  });

  it("allows localhost HTTP only for the controlled same-origin Stripe route", () => {
    expect(validatePaymentRedirect("STRIPE", "http://localhost:3000/payments/stripe", "http://localhost:3000").href).toBe("http://localhost:3000/payments/stripe");
  });
});
