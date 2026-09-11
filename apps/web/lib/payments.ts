import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PaymentService } from "../../../modules/payments/application/PaymentService";
import type { PaymentProviderPort } from "../../../modules/payments/application/PaymentPorts";
import { D1PaymentRepository } from "../../../modules/payments/infrastructure/D1PaymentRepository";
import { WompiPaymentProvider } from "../../../modules/payments/infrastructure/WompiPaymentProvider";
import { StripePaymentProvider } from "../../../modules/payments/infrastructure/StripePaymentProvider";
import { MercadoPagoPaymentProvider } from "../../../modules/payments/infrastructure/MercadoPagoPaymentProvider";
import { PayPalPaymentProvider } from "../../../modules/payments/infrastructure/PayPalPaymentProvider";
import { BinancePayPaymentProvider } from "../../../modules/payments/infrastructure/BinancePayPaymentProvider";
import { verifyWompiWebhook } from "../../../modules/payments/infrastructure/WompiWebhookVerifier";
import { D1OrderRepository } from "../../../modules/orders/infrastructure/D1OrderRepository";
import { D1ReservationRepository } from "../../../modules/orders/infrastructure/D1ReservationRepository";

export async function paymentContext() {
  const { env } = getCloudflareContext();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ecommerce-iphone.programadorkevinsvega.workers.dev";
  const provider = createProvider(env, appUrl);
  const orders = new D1OrderRepository(env.DB);
  const reservations = new D1ReservationRepository(env.DB);
  const payments = new D1PaymentRepository(env.DB);
  return { env, orders, reservations, payments, provider, service: new PaymentService(payments, provider, orders, reservations), verifyWompiWebhook };
}

function createProvider(env: CloudflareEnv & Record<string, string | undefined>, appUrl: string): PaymentProviderPort {
  const selected = (env.PAYMENT_PROVIDER ?? "WOMPI").toUpperCase();
  switch (selected) {
    case "WOMPI": return new WompiPaymentProvider(env.WOMPI_PUBLIC_KEY ?? "", env.WOMPI_PRIVATE_KEY ?? "", env.WOMPI_INTEGRITY_SECRET ?? "", appUrl);
    case "STRIPE": return new StripePaymentProvider(env.STRIPE_SECRET_KEY ?? "", env.STRIPE_PUBLISHABLE_KEY ?? "", appUrl);
    case "MERCADOPAGO": return new MercadoPagoPaymentProvider(env.MERCADOPAGO_ACCESS_TOKEN ?? "", appUrl);
    case "PAYPAL": return new PayPalPaymentProvider(env.PAYPAL_CLIENT_ID ?? "", env.PAYPAL_CLIENT_SECRET ?? "", appUrl);
    case "BINANCE_PAY": return new BinancePayPaymentProvider(env.BINANCE_PAY_API_KEY ?? "", env.BINANCE_PAY_SECRET_KEY ?? "", env.BINANCE_PAY_CERTIFICATE_SN ?? "", appUrl);
    default: throw new Error(`Unsupported production payment provider: ${selected}`);
  }
}
