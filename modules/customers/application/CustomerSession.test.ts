import { describe, expect, it } from "vitest";
import { CustomerSessionService, type SessionTokenGenerator } from "./CustomerSession";
import type { CustomerSession, CustomerSessionRepository } from "./CustomerSessionRepository";

class InMemorySessions implements CustomerSessionRepository {
  private readonly sessions = new Map<string, CustomerSession>();
  async create(customerId: string, tokenHash: string, expiresAt: string): Promise<CustomerSession> {
    const session = { id: crypto.randomUUID(), customerId, expiresAt };
    this.sessions.set(tokenHash, session);
    return session;
  }
  async findActiveByTokenHash(tokenHash: string): Promise<CustomerSession | null> { return this.sessions.get(tokenHash) ?? null; }
  async revoke(id: string): Promise<void> {
    for (const [hash, session] of this.sessions) if (session.id === id) this.sessions.delete(hash);
  }
}

class Tokens implements SessionTokenGenerator {
  async generate(): Promise<string> { return "session-token-1234567890"; }
  async hash(token: string): Promise<string> { return `hash:${token}`; }
}

describe("CustomerSessionService", () => {
  it("creates and resolves an expiring customer session", async () => {
    const service = new CustomerSessionService(new InMemorySessions(), new Tokens());
    const created = await service.create("customer-1");
    expect(created.token).toBe("session-token-1234567890");
    expect((await service.resolve(created.token))?.customerId).toBe("customer-1");
  });

  it("rejects expired sessions", async () => {
    const service = new CustomerSessionService(new InMemorySessions(), new Tokens(), -1);
    const created = await service.create("customer-1");
    expect(await service.resolve(created.token)).toBeNull();
  });
});
