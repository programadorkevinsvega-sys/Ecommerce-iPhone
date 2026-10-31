import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationDeliveryRepository } from "../application/NotificationDeliveryRepository";
import type { NotificationRecipient } from "../domain/NotificationEvent";

function sanitizeNotificationError(error: string): string {
  return error
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(api[_-]?key|(?:access[_-]?|refresh[_-]?)?token|password|secret|authorization)\s*[:=]\s*["']?[^,\s"']+/gi,
      "$1=[REDACTED]",
    )
    .replace(/https?:\/\/[^/\s:@]+:[^@\s]+@/gi, "https://[REDACTED]@")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

export class D1NotificationDeliveryRepository implements NotificationDeliveryRepository {
  constructor(private readonly db: D1Database) {}

  async hasSentEmail(
    notificationId: string,
    recipient: NotificationRecipient,
    recipientEmail: string,
  ): Promise<boolean> {
    const row = await this.db
      .prepare(
        "SELECT 1 AS found FROM notification_channel_deliveries WHERE notification_id=? AND channel='EMAIL' AND recipient_type=? AND recipient_id=? AND recipient=? AND status='SENT' LIMIT 1",
      )
      .bind(notificationId, recipient.type, recipient.id, recipientEmail)
      .first<{ found: number }>();
    return Boolean(row);
  }

  async claimEmail(
    notificationId: string,
    recipient: NotificationRecipient,
    recipientEmail: string,
    leaseSeconds: number,
  ): Promise<boolean> {
    const lease = Math.max(60, Math.min(Math.trunc(leaseSeconds), 1800));
    const token = crypto.randomUUID();
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO notification_channel_deliveries (id,notification_id,channel,recipient_type,recipient_id,recipient,status,attempts,provider) VALUES (?,?,?,?,?,?,'PENDING',0,'resend')",
      )
      .bind(
        crypto.randomUUID(),
        notificationId,
        "EMAIL",
        recipient.type,
        recipient.id,
        recipientEmail,
      )
      .run();

    const result = await this.db
      .prepare(
        "UPDATE notification_channel_deliveries SET status='CLAIMED',attempts=attempts+1,lease_token=?,lease_expires_at=datetime('now','+' || ? || ' seconds'),last_error=NULL WHERE notification_id=? AND channel='EMAIL' AND recipient_type=? AND recipient_id=? AND recipient=? AND (status IN ('PENDING','FAILED') OR (status='CLAIMED' AND lease_expires_at<=CURRENT_TIMESTAMP))",
      )
      .bind(token, lease, notificationId, recipient.type, recipient.id, recipientEmail)
      .run();

    return result.meta.changes === 1;
  }

  async recordEmail(input: {
    notificationId: string;
    recipient: NotificationRecipient;
    recipientEmail: string;
    provider: string;
    providerMessageId?: string | undefined;
    status: "SENT" | "FAILED" | "TERMINAL";
    error?: string | undefined;
  }): Promise<void> {
    await this.db
      .prepare(
        "UPDATE notification_channel_deliveries SET status=?,provider=?,provider_message_id=?,last_error=?,lease_token=NULL,lease_expires_at=NULL,sent_at=CASE WHEN ?='SENT' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE notification_id=? AND channel='EMAIL' AND recipient_type=? AND recipient_id=? AND recipient=?",
      )
      .bind(
        input.status,
        input.provider,
        input.providerMessageId ?? null,
        input.error ? sanitizeNotificationError(input.error) : null,
        input.status,
        input.notificationId,
        input.recipient.type,
        input.recipient.id,
        input.recipientEmail,
      )
      .run();
  }
}
