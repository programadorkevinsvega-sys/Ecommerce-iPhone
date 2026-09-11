import type { D1Database } from "@cloudflare/workers-types";
import type { AuditFilter, AuditRepository } from "../application/AdminAuditViewer";

export class D1AdminAuditRepository implements AuditRepository {
  constructor(private readonly db: D1Database) {}

  async list(filter: AuditFilter): Promise<Readonly<{ items: unknown[]; total: number }>> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => { clauses.push(sql); values.push(value); };
    if (filter.adminUserId) add("admin_user_id = ?", filter.adminUserId);
    if (filter.action) add("action = ?", filter.action);
    if (filter.resourceType) add("resource_type = ?", filter.resourceType);
    if (filter.resourceId) add("resource_id = ?", filter.resourceId);
    if (filter.from) add("created_at >= ?", filter.from);
    if (filter.to) add("created_at <= ?", filter.to);
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const count = await this.db.prepare(`SELECT COUNT(*) AS count FROM admin_audit_log${where}`).bind(...values).first<{ count: number }>();
    const rows = await this.db.prepare(`SELECT id,admin_user_id,action,resource_type,resource_id,payload_json,created_at FROM admin_audit_log${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...values, filter.limit, filter.offset).all();
    return { items: rows.results, total: Number(count?.count ?? 0) };
  }
}
