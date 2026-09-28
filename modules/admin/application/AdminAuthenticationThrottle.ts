import type { AuditPort } from "./AuditPort";
import type { AdminLoginRateLimitPort } from "./AdminLoginRateLimitPort";

export class AdminAuthenticationThrottle<
  T extends {
    execute(
      email: string,
      password: string,
      ipHash?: string,
      userAgentHash?: string,
    ): Promise<unknown>;
  },
> {
  constructor(
    private readonly delegate: T,
    private readonly limit: AdminLoginRateLimitPort,
    private readonly hash: (value: string) => Promise<string>,
    private readonly audit: AuditPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    email: string,
    password: string,
    ipHash?: string,
    userAgentHash?: string,
  ) {
    const now = this.now();
    const ip = await this.limit.consume(
      "ip",
      ipHash || "unknown",
      20,
      900,
      now,
    );
    const account = ip.allowed
      ? await this.limit.consume(
          "account",
          await this.hash(email.trim().toLowerCase()),
          10,
          900,
          now,
        )
      : ip;

    if (!account.allowed) {
      const error = new Error("RATE_LIMITED") as Error & {
        retryAfterSeconds: number;
      };
      error.retryAfterSeconds = account.retryAfterSeconds;
      await this.audit.audit(
        null,
        "ADMIN_LOGIN_RATE_LIMITED",
        "admin_login",
        null,
        {
          scope: ip.allowed ? "account" : "ip",
          retryAfterSeconds: account.retryAfterSeconds,
        },
      );
      throw error;
    }

    return this.delegate.execute(email, password, ipHash, userAgentHash);
  }
}
