import type { D1Database } from "@cloudflare/workers-types";
import type { AdminSessionRepository } from "../application/AdminSessionRepository";
import { D1AdminRepository } from "./D1AdminRepository";

export class D1AdminAuthSessionRepository implements AdminSessionRepository {
  private readonly repository: D1AdminRepository;

  constructor(db: D1Database) {
    this.repository = new D1AdminRepository(db);
  }

  create(adminUserId: string, tokenHash: string, expiresAt: string, ipHash?: string, userAgentHash?: string) {
    return this.repository.createSession(adminUserId, tokenHash, expiresAt, ipHash, userAgentHash);
  }

  findByTokenHash(tokenHash: string) {
    return this.repository.findSession(tokenHash);
  }

  revoke(sessionId: string) {
    return this.repository.revokeSession(sessionId);
  }

  revokeAll(adminUserId: string) {
    return this.repository.revokeAllSessions(adminUserId);
  }
}
