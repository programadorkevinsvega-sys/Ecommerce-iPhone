import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationPreferenceRepository, NotificationPreference } from "../application/NotificationPreferenceRepository";
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

  async list(recipient: NotificationRecipient): Promise<NotificationPreference[]> {
    const rows = await this.db.prepare(
      "SELECT channel,event_type,enabled FROM notification_preferences WHERE recipient_type=? AND recipient_id=? ORDER BY channel,event_type",
    ).bind(recipient.type, recipient.id).all<{ channel: NotificationChannel; event_type: string; enabled: number }>();
    return rows.results.map((row) => ({
      channel: row.channel,
      eventType: row.event_type,
      enabled: Boolean(row.enabled),
    }));
  }

  async set(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    eventType: string,
    enabled: boolean,
  ): Promise<void> {
    await this.db.prepare(
      "INSERT INTO notification_preferences (recipient_type,recipient_id,channel,event_type,enabled,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(recipient_type,recipient_id,channel,event_type) DO UPDATE SET enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP",
    ).bind(
      recipient.type,
      recipient.id,
      channel,
      eventType,
      enabled ? 1 : 0,
    ).run();
  }
}
