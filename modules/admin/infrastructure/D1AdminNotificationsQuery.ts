import type { D1Database } from "@cloudflare/workers-types";
import type { AdminNotificationsQuery, AdminNotificationsSnapshot } from "../application/AdminNotificationsQuery";

export class D1AdminNotificationsQuery implements AdminNotificationsQuery {
  constructor(private readonly db: D1Database) {}
  async execute(limit: number): Promise<AdminNotificationsSnapshot> {
    const rows = await this.db.prepare("SELECT d.id,d.outbox_id,d.channel,d.recipient,d.template,d.provider,d.provider_message_id,d.status,d.attempts,d.error_message,d.created_at,o.event_type,o.aggregate_id FROM notification_deliveries d JOIN notification_outbox o ON o.id=d.outbox_id ORDER BY d.created_at DESC LIMIT ?").bind(limit).all();
    const pending = await this.db.prepare("SELECT status,COUNT(*) AS count FROM notification_outbox GROUP BY status").all();
    return { deliveries: rows.results, queue: pending.results };
  }
}
