import type { TechnicianUser } from "../domain/TechnicianUser";
export interface TechnicianSessionRepository {
  create(technicianUserId: string, tokenHash: string, expiresAt: string, ipHash?: string, userAgentHash?: string): Promise<string>;
  findByTokenHash(tokenHash: string): Promise<{ sessionId: string; user: TechnicianUser } | null>;
  revoke(sessionId: string): Promise<void>;
  revokeAll(technicianUserId: string): Promise<void>;
}
