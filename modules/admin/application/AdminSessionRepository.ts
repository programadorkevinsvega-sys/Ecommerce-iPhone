import type { AdminUser } from "../domain/AdminUser";

export interface AdminSessionRepository {
  create(adminUserId: string, tokenHash: string, expiresAt: string, ipHash?: string, userAgentHash?: string): Promise<string>;
  findByTokenHash(tokenHash: string): Promise<{ sessionId: string; user: AdminUser } | null>;
  revoke(sessionId: string): Promise<void>;
  revokeAll(adminUserId: string): Promise<void>;
}
