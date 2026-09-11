import type { CustomerSession, CustomerSessionRepository } from "./CustomerSessionRepository";

export interface SessionTokenGenerator {
  generate(): Promise<string>;
  hash(token: string): Promise<string>;
}

export class CustomerSessionService {
  constructor(
    private readonly repository: CustomerSessionRepository,
    private readonly tokens: SessionTokenGenerator,
    private readonly ttlSeconds = 60 * 60 * 24 * 30,
  ) {}

  async create(customerId: string): Promise<Readonly<{ token: string; session: CustomerSession }>> {
    const token = await this.tokens.generate();
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000).toISOString();
    const session = await this.repository.create(customerId, await this.tokens.hash(token), expiresAt);
    return { token, session };
  }

  async resolve(token: string): Promise<CustomerSession | null> {
    if (!token) return null;
    const session = await this.repository.findActiveByTokenHash(await this.tokens.hash(token));
    if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
    return session;
  }

  async revoke(token: string): Promise<void> {
    const session = await this.resolve(token);
    if (session) await this.repository.revoke(session.id);
  }
}
