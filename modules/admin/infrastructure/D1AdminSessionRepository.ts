import type { D1Database } from "@cloudflare/workers-types";
import type { SessionRepository } from "../application/AdminUserManagement";

export class D1AdminSessionRepository implements SessionRepository {
  constructor(private readonly db: D1Database) {}

  async revokeAllSessions(adminUserId: string): Promise<void> {
    await this.db
      .prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_user_id=? AND revoked_at IS NULL")
      .bind(adminUserId)
      .run();
  }
}
