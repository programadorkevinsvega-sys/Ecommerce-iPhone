import type { CustomerSecurityEventType, CustomerSecurityAuditRepository } from "../../../modules/customers/application/CustomerSecurityAuditRepository";

export function customerRequestOrigin(request: Request): Readonly<{ sourceIp: string | null; userAgent: string | null }> {
  const sourceIp = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",", 1)[0]?.trim() ?? null;
  const userAgent = request.headers.get("User-Agent")?.slice(0, 512) ?? null;
  return { sourceIp, userAgent };
}

export async function recordCustomerSecurityEvent(
  audit: CustomerSecurityAuditRepository,
  request: Request,
  eventType: CustomerSecurityEventType,
  customerId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const origin = customerRequestOrigin(request);
  const event = { customerId, eventType, sourceIp: origin.sourceIp, userAgent: origin.userAgent };
  await audit.record(metadata === undefined ? event : { ...event, metadata });
}
