import type { PaymentProvider } from "../../../modules/payments/domain/Payment";

type PaymentProviderSecurityConfig = Readonly<{
  label: string;
  allowedHostnames: readonly string[];
  sameOriginPath?: string;
}>;

export const PAYMENT_PROVIDER_CONFIG = {
  WOMPI: {
    label: "Wompi",
    allowedHostnames: ["checkout.wompi.co"],
  },
  STRIPE: {
    label: "Tarjeta / Stripe",
    allowedHostnames: ["checkout.stripe.com"],
    sameOriginPath: "/payments/stripe",
  },
  MERCADOPAGO: {
    label: "Mercado Pago",
    allowedHostnames: ["www.mercadopago.com.co", "mercadopago.com.co", "www.mercadopago.com", "mercadopago.com"],
  },
  PAYPAL: {
    label: "PayPal",
    allowedHostnames: ["www.paypal.com", "paypal.com"],
  },
  BINANCE_PAY: {
    label: "Binance Pay",
    allowedHostnames: ["pay.binance.com"],
  },
} satisfies Record<PaymentProvider, PaymentProviderSecurityConfig>;

export const PAYMENT_PROVIDER_OPTIONS = Object.entries(PAYMENT_PROVIDER_CONFIG) as Array<
  [PaymentProvider, PaymentProviderSecurityConfig]
>;

function isAllowedHostname(hostname: string, allowedHostnames: readonly string[]): boolean {
  return allowedHostnames.includes(hostname.toLowerCase());
}

function isLocalDevelopmentOrigin(url: URL): boolean {
  return (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") && url.protocol === "http:";
}

export function validatePaymentRedirect(provider: PaymentProvider, checkoutUrl: string, currentOrigin: string): URL {
  const config = PAYMENT_PROVIDER_CONFIG[provider];
  if (!config || typeof checkoutUrl !== "string" || !checkoutUrl.trim()) {
    throw new Error("Invalid payment redirect");
  }

  let url: URL;
  let origin: URL;
  try {
    url = new URL(checkoutUrl, currentOrigin);
    origin = new URL(currentOrigin);
  } catch {
    throw new Error("Invalid payment redirect");
  }

  if (url.username || url.password) {
    throw new Error("Invalid payment redirect");
  }

  const sameOrigin = url.origin === origin.origin;
  if (sameOrigin) {
    if (!config.sameOriginPath || url.pathname !== config.sameOriginPath || url.search || url.hash) {
      throw new Error("Invalid same-origin payment redirect");
    }
    if (url.protocol !== "https:" && !isLocalDevelopmentOrigin(url)) {
      throw new Error("Payment redirects must use HTTPS");
    }
    return url;
  }

  if (url.protocol !== "https:") {
    throw new Error("Payment redirects must use HTTPS");
  }

  if (!isAllowedHostname(url.hostname, config.allowedHostnames)) {
    throw new Error("Payment redirect hostname is not authorized for the selected provider");
  }

  return url;
}
