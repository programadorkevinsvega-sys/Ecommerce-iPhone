import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationPreferenceRepository } from "../application/NotificationPreferenceRepository";
import type { NotificationRecipient, NotificationChannel } from "../domain/NotificationEvent";

export class D1NotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly db: D1Database) {}

  async isEnabled(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    eventType: string,
  ): Promise<boolean> {
    const row = await this.db.prepare(
      "SELECT enabled FROM notification_preferences WHERE recipient_type=? AND recipient_id=? AND channel=? AND (event_type=? OR event_type='*') ORDER BY CASE WHEN event_type=? THEN 0 ELSE 1 END LIMIT 1",
    ).bind(
      recipient.type,
      recipient.id,
      channel,
      eventType,
      eventType,
    ).first<{ enabled: number }>();
    return row ? Boolean(row.enabled) : true;
  }
}