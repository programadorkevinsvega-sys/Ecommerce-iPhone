import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationAuditPort } from "../application/NotificationAuditPort";

export class D1NotificationAuditPort implements NotificationAuditPort {
  constructor(private readonly db: D1Database) {}
  async record(input: {
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string | undefined;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.prepare(
      "INSERT INTO admin_audit_log (id,admin_user_id,action,resource_type,resource_id,payload_json) VALUES (?,?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      input.actorId,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      JSON.stringify(input.payload),
    ).run();
  }
}
