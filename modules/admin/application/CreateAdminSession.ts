import type { AdminSessionRepository } from "./AdminSessionRepository";

export class CreateAdminSession {
  constructor(
    private readonly sessions: AdminSessionRepository,
    private readonly hashToken: (value: string) => Promise<string>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(adminUserId: string, token: string, expiresAt: Date, ipHash?: string, userAgentHash?: string): Promise<string> {
    const adminId = adminUserId.trim();
    if (!adminId || !token) throw new Error("INVALID_ADMIN_SESSION");
    if (expiresAt.getTime() <= this.now().getTime()) throw new Error("INVALID_SESSION_EXPIRY");
    return this.sessions.create(adminId, await this.hashToken(token), expiresAt.toISOString(), ipHash, userAgentHash);
  }
}
