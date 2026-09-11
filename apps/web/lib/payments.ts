import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PaymentService } from "../../../modules/payments/application/PaymentService";
import { PaymentProviderRegistry } from "../../../modules/payments/application/PaymentProviderRegistry";
import type { PaymentProvider } from "../../../modules/payments/domain/Payment";
import { D1PaymentRepository } from "../../../modules/payments/infrastructure/D1PaymentRepository";
import { WompiPaymentProvider } from "../../../modules/payments/infrastructure/WompiPaymentProvider";
import { StripePaymentProvider } from "../../../modules/payments/infrastructure/StripePaymentProvider";
import { MercadoPagoPaymentProvider } from "../../../modules/payments/infrastructure/MercadoPagoPaymentProvider";
import { PayPalPaymentProvider } from "../../../modules/payments/infrastructure/PayPalPaymentProvider";
import { BinancePayPaymentProvider } from "../../../modules/payments/infrastructure/BinancePayPaymentProvider";
import { verifyWompiWebhook } from "../../../modules/payments/infrastructure/WompiWebhookVerifier";
import { D1OrderRepository } from "../../../modules/orders/infrastructure/D1OrderRepository";
import { D1ReservationRepository } from "../../../modules/orders/infrastructure/D1ReservationRepository";

type PaymentEnv = CloudflareEnv & Record<string, string | undefined>;

export async function paymentContext() {
  const { env } = getCloudflareContext();
  const paymentEnv = env as PaymentEnv;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ecommerce-iphone.programadorkevinsvega.workers.dev";
  const providers = createProviders(paymentEnv, appUrl);
  const orders = new D1OrderRepository(paymentEnv.DB);
  const reservations = new D1ReservationRepository(paymentEnv.DB);
  const payments = new D1PaymentRepository(paymentEnv.DB);
  return {
    env: paymentEnv,
    orders,
    reservations,
    payments,
    providers,
    service: new PaymentService(payments, providers, orders, reservations),
    verifyWompiWebhook,
  };
}

function createProviders(env: PaymentEnv, appUrl: string): PaymentProviderRegistry {
  const providers = [
    new WompiPaymentProvider(env.WOMPI_PUBLIC_KEY ?? "", env.WOMPI_PRIVATE_KEY ?? "", env.WOMPI_INTEGRITY_SECRET ?? "", appUrl),
    new StripePaymentProvider(env.STRIPE_SECRET_KEY ?? "", env.STRIPE_PUBLISHABLE_KEY ?? "", appUrl),
    new MercadoPagoPaymentProvider(env.MERCADOPAGO_ACCESS_TOKEN ?? "", appUrl),
    new PayPalPaymentProvider(env.PAYPAL_CLIENT_ID ?? "", env.PAYPAL_CLIENT_SECRET ?? "", appUrl),
    new BinancePayPaymentProvider(env.BINANCE_PAY_API_KEY ?? "", env.BINANCE_PAY_SECRET_KEY ?? "", env.BINANCE_PAY_CERTIFICATE_SN ?? "", appUrl),
  ];
  return new PaymentProviderRegistry(providers);
}

export function parsePaymentProvider(value: unknown): PaymentProvider {
  if (typeof value !== "string") throw new Error("paymentProvider is required");
  const normalized = value.trim().toUpperCase();
  if (!["WOMPI", "STRIPE", "MERCADOPAGO", "PAYPAL", "BINANCE_PAY"].includes(normalized)) throw new Error("Unsupported payment provider");
  return normalized as PaymentProvider;
}
