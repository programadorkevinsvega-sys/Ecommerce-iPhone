export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<Readonly<{ allowed: boolean; remaining: number }>>;
}

export interface AuditLogger {
  record(entry: Readonly<{
    actorId: string | null;
    action: string;
    resource: string;
    resourceId: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }>): Promise<void>;
}
