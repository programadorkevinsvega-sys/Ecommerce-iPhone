import type { D1Database } from "@cloudflare/workers-types";
import { AdminUser, type AdminUserProps } from "../domain/AdminUser";
import type { AdminRole } from "../application/Rbac";

export class D1AdminRepository {
  constructor(private readonly db: D1Database) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const row = await this.db.prepare("SELECT * FROM admin_users WHERE email = ? COLLATE NOCASE LIMIT 1").bind(email.trim().toLowerCase()).first<Record<string, unknown>>();
    return row ? this.mapUser(row) : null;
  }
  async findById(id: string): Promise<AdminUser | null> {
    const row = await this.db.prepare("SELECT * FROM admin_users WHERE id = ? LIMIT 1").bind(id).first<Record<string, unknown>>();
    return row ? this.mapUser(row) : null;
  }
  async saveUser(user: AdminUser): Promise<void> {
    const p = user.toPrimitives();
    await this.db.prepare(`INSERT INTO admin_users (id,email,password_hash,role,first_name,last_name,active,failed_login_count,locked_until,last_login_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,role=excluded.role,first_name=excluded.first_name,last_name=excluded.last_name,active=excluded.active,failed_login_count=excluded.failed_login_count,locked_until=excluded.locked_until,last_login_at=excluded.last_login_at,updated_at=excluded.updated_at`).bind(p.id,p.email,p.passwordHash,p.role,p.firstName,p.lastName,p.active?1:0,p.failedLoginCount,p.lockedUntil??null,p.lastLoginAt??null,p.createdAt,p.updatedAt).run();
  }
  async createSession(adminUserId: string, tokenHash: string, expiresAt: string, ipHash?: string, userAgentHash?: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.prepare("INSERT INTO admin_sessions (id,admin_user_id,token_hash,expires_at,ip_hash,user_agent_hash) VALUES (?,?,?,?,?,?)").bind(id,adminUserId,tokenHash,expiresAt,ipHash??null,userAgentHash??null).run();
    return id;
  }
  async findSession(tokenHash: string): Promise<{ sessionId: string; user: AdminUser } | null> {
    const row = await this.db.prepare(`SELECT s.id AS session_id, u.* FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP AND u.active=1 LIMIT 1`).bind(tokenHash).first<Record<string, unknown>>();
    return row ? { sessionId: String(row.session_id), user: this.mapUser(row) } : null;
  }
  async revokeSession(sessionId: string): Promise<void> { await this.db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND revoked_at IS NULL").bind(sessionId).run(); }
  async revokeAllSessions(adminUserId: string): Promise<void> { await this.db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_user_id=? AND revoked_at IS NULL").bind(adminUserId).run(); }
  async audit(adminUserId: string | null, action: string, resourceType: string, resourceId: string | null, payload: unknown, ipHash?: string): Promise<void> { await this.db.prepare("INSERT INTO admin_audit_log (id,admin_user_id,action,resource_type,resource_id,payload_json,ip_hash) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),adminUserId,action,resourceType,resourceId,JSON.stringify(payload),ipHash??null).run(); }

  private mapUser(r: Record<string, unknown>): AdminUser {
    return AdminUser.create(String(r.id), {
      email: String(r.email), passwordHash: String(r.password_hash), role: String(r.role) as AdminRole,
      firstName: String(r.first_name), lastName: String(r.last_name), active: Number(r.active) === 1,
      failedLoginCount: Number(r.failed_login_count ?? 0), lockedUntil: r.locked_until ? String(r.locked_until) : undefined,
      lastLoginAt: r.last_login_at ? String(r.last_login_at) : undefined, createdAt: String(r.created_at), updatedAt: String(r.updated_at),
    } as AdminUserProps);
  }
}
