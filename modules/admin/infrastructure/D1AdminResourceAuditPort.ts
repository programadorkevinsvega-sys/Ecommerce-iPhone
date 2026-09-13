import type { D1Database } from "@cloudflare/workers-types";
import type { AdminResourceAuditPort } from "../application/AdminResourceAuditPort";

export class D1AdminResourceAuditPort implements AdminResourceAuditPort {
  constructor(private readonly db: D1Database) {}

  async audit(adminUserId: string, action: string, resourceType: string, resourceId: string | null, payload: unknown): Promise<void> {
    await this.db.prepare("INSERT INTO admin_audit_log (id,admin_user_id,action,resource_type,resource_id,payload_json) VALUES (?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), adminUserId, action, resourceType, resourceId, JSON.stringify(payload))
      .run();
  }
}
