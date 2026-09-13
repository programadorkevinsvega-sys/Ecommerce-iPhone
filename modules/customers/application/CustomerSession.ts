import type { CustomerSession, CustomerSessionRepository } from "./CustomerSessionRepository";

export interface SessionTokenGenerator {
  generate(): Promise<string>;
  hash(token: string): Promise<string>;
}

function parseExpiryTimestamp(expiresAt: string): number {
  const value = expiresAt.trim();
  const sqliteUtc = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(value);
  const normalized = sqliteUtc ? `${sqliteUtc[1]}T${sqliteUtc[2]}Z` : value;
  return Date.parse(normalized);
}

export class CustomerSessionService {
  constructor(
    private readonly repository: CustomerSessionRepository,
    private readonly tokens: SessionTokenGenerator,
    private readonly ttlSeconds = 60 * 60 * 24 * 30,
  ) {}

  async create(customerId: string): Promise<Readonly<{ token: string; session: CustomerSession }>> {
    const token = await this.tokens.generate();
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000).toISOString().slice(0, 19).replace("T", " ");
    const session = await this.repository.create(customerId, await this.tokens.hash(token), expiresAt);
    return { token, session };
  }

  async resolve(token: string): Promise<CustomerSession | null> {
    if (!token) return null;
    const session = await this.repository.findActiveByTokenHash(await this.tokens.hash(token));
    if (!session) return null;
    const expiresAt = parseExpiryTimestamp(session.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return session;
  }

  async revoke(token: string): Promise<void> {
    const session = await this.resolve(token);
    if (session) await this.repository.revoke(session.id);
  }
}
