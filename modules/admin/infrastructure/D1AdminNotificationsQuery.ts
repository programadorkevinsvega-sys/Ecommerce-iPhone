import type { D1Database } from "@cloudflare/workers-types";
import type { AdminNotificationsQuery, AdminNotificationsSnapshot } from "../application/AdminNotificationsQuery";

export class D1AdminNotificationsQuery implements AdminNotificationsQuery {
  constructor(private readonly db: D1Database) {}

  async execute(limit: number): Promise<AdminNotificationsSnapshot> {
    const rows = await this.db.prepare(
      "SELECT * FROM (" +
      "SELECT d.id,d.notification_id AS outbox_id,d.channel,d.recipient,d.channel AS template,d.provider,d.provider_message_id,d.status,d.attempts,d.last_error AS error_message,d.created_at,i.event_type,o.aggregate_id " +
      "FROM notification_channel_deliveries d " +
      "JOIN notification_inbox i ON i.id=d.notification_id " +
      "LEFT JOIN notification_outbox o ON o.id=i.event_id " +
      "UNION ALL " +
      "SELECT d.id,d.outbox_id,d.channel,d.recipient,d.template,d.provider,d.provider_message_id,d.status,d.attempts,d.error_message,d.created_at,o.event_type,o.aggregate_id " +
      "FROM notification_deliveries d " +
      "JOIN notification_outbox o ON o.id=d.outbox_id" +
      ") ORDER BY created_at DESC LIMIT ?",
    ).bind(limit).all();

    const pending = await this.db.prepare(
      "SELECT CASE WHEN terminal_at IS NOT NULL THEN 'TERMINAL' ELSE status END AS status,COUNT(*) AS count FROM notification_outbox GROUP BY CASE WHEN terminal_at IS NOT NULL THEN 'TERMINAL' ELSE status END",
    ).all();

    return { deliveries: rows.results, queue: pending.results };
  }
}
