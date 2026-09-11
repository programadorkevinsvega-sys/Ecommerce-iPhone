import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CustomerSessionService } from "../../../modules/customers/application/CustomerSession";
import { D1CustomerSessionRepository } from "../../../modules/customers/infrastructure/D1CustomerSessionRepository";
import { WebCryptoCustomerSessionTokenGenerator } from "../../../modules/customers/infrastructure/WebCryptoCustomerSessionTokenGenerator";

export const CUSTOMER_SESSION_COOKIE = "customer_session";

export async function currentCustomerId(): Promise<string | null> {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const { env } = getCloudflareContext();
  const sessions = new CustomerSessionService(new D1CustomerSessionRepository(env.DB), new WebCryptoCustomerSessionTokenGenerator());
  return (await sessions.resolve(token))?.customerId ?? null;
}
