import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PaymentService } from "../../../modules/payments/application/PaymentService";
import { D1PaymentRepository } from "../../../modules/payments/infrastructure/D1PaymentRepository";
import { WompiPaymentProvider } from "../../../modules/payments/infrastructure/WompiPaymentProvider";
import { D1OrderRepository } from "../../../modules/orders/infrastructure/D1OrderRepository";
import { D1ReservationRepository } from "../../../modules/orders/infrastructure/D1ReservationRepository";

export async function paymentContext() {
  const { env } = getCloudflareContext();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ecommerce-iphone.programadorkevinsvega.workers.dev";
  const provider = new WompiPaymentProvider(
    env.WOMPI_PUBLIC_KEY ?? "",
    env.WOMPI_PRIVATE_KEY ?? "",
    env.WOMPI_INTEGRITY_SECRET ?? "",
    appUrl,
  );
  const orders = new D1OrderRepository(env.DB);
  const reservations = new D1ReservationRepository(env.DB);
  const payments = new D1PaymentRepository(env.DB);
  return { env, orders, reservations, payments, provider, service: new PaymentService(payments, provider, orders, reservations) };
}
