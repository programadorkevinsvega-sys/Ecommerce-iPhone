import type { D1Database } from "@cloudflare/workers-types";
import type { CustomerSession, CustomerSessionRepository } from "../application/CustomerSessionRepository";

export class D1CustomerSessionRepository implements CustomerSessionRepository {
  constructor(private readonly db: D1Database) {}

  async create(customerId: string, tokenHash: string, expiresAt: string): Promise<CustomerSession> {
    const id = crypto.randomUUID();
    await this.db
      .prepare("INSERT INTO customer_sessions(id,customer_id,token_hash,expires_at) VALUES(?,?,?,?)")
      .bind(id, customerId, tokenHash, expiresAt)
      .run();
    return { id, customerId, expiresAt };
  }

  async findActiveByTokenHash(tokenHash: string): Promise<CustomerSession | null> {
    const row = await this.db
      .prepare("SELECT id,customer_id,expires_at FROM customer_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1")
      .bind(tokenHash)
      .first<{ id: string; customer_id: string; expires_at: string }>();
    if (!row) return null;
    await this.db.prepare("UPDATE customer_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
    return { id: row.id, customerId: row.customer_id, expiresAt: row.expires_at };
  }

  async revoke(id: string): Promise<void> {
    await this.db.prepare("UPDATE customer_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND revoked_at IS NULL").bind(id).run();
  }
}
