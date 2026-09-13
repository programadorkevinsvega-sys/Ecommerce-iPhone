import type { AdminSessionRepository } from "./AdminSessionRepository";
import type { AuditPort } from "./AuditPort";

export class LogoutAdmin {
  constructor(
    private readonly sessions: AdminSessionRepository,
    private readonly audit: AuditPort,
    private readonly hashToken: (value: string) => Promise<string>,
  ) {}

  async execute(adminUserId: string, token: string | null | undefined, ipHash?: string): Promise<void> {
    const adminId = adminUserId.trim();
    if (!adminId || !token) return;
    const found = await this.sessions.findByTokenHash(await this.hashToken(token));
    if (!found) return;
    await this.sessions.revoke(found.sessionId);
    await this.audit.audit(adminId, "ADMIN_LOGOUT", "admin_user", adminId, { ipHash: ipHash ?? null });
  }
}
