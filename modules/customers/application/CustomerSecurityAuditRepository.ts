export type CustomerSecurityEventType =
  | "REGISTERED"
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PROFILE_UPDATED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED";

export type CustomerSecurityEvent = Readonly<{
  customerId: string | null;
  eventType: CustomerSecurityEventType;
  sourceIp: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
}>;

export interface CustomerSecurityAuditRepository {
  record(event: CustomerSecurityEvent): Promise<void>;
}
