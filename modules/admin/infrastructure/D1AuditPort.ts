import type { D1Database } from "@cloudflare/workers-types";
import type { AuditPort } from "../application/AuditPort";

export class D1AuditPort implements AuditPort {
  constructor(private readonly db: D1Database) {}

  async audit(
    adminUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    payload: unknown,
  ): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO admin_audit_log (id,admin_user_id,action,resource_type,resource_id,payload_json,ip_hash) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        adminUserId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(payload),
        null,
      )
      .run();
  }
}
