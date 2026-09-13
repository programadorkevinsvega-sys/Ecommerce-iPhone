import type { AdminSessionRepository } from "./AdminSessionRepository";
import type { AuditPort } from "./AuditPort";

export class LogoutAdmin {
  constructor(private readonly sessions: AdminSessionRepository, private readonly audit: AuditPort) {}

  async execute(adminUserId: string, sessionId: string, ipHash?: string): Promise<void> {
    const adminId = adminUserId.trim();
    const id = sessionId.trim();
    if (!adminId || !id) return;
    await this.sessions.revoke(id);
    await this.audit.audit(adminId, "ADMIN_LOGOUT", "admin_user", adminId, { ipHash: ipHash ?? null });
  }
}
