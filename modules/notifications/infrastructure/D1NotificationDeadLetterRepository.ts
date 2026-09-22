import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationDeadLetter, NotificationDeadLetterRepository } from "../application/NotificationDeadLetterRepository";

function mapRow(row: Record<string, unknown>): NotificationDeadLetter {
  return {
    id: String(row.id),
    queueName: String(row.queue_name),
    ...(row.message_id ? { messageId: String(row.message_id) } : {}),
    messageBody: String(row.message_body),
    status: String(row.status) as NotificationDeadLetter["status"],
    attempts: Number(row.attempts ?? 0),
    firstSeenAt: String(row.first_seen_at),
    ...(row.last_replayed_at ? { lastReplayedAt: String(row.last_replayed_at) } : {}),
    ...(row.replayed_by ? { replayedBy: String(row.replayed_by) } : {}),
  };
}

export class D1NotificationDeadLetterRepository implements NotificationDeadLetterRepository {
  constructor(private readonly db: D1Database) {}

  async record(input: { id: string; queueName: string; messageId?: string | undefined; messageBody: string }): Promise<void> {
    await this.db.prepare(
      "INSERT INTO notification_dead_letters (id,queue_name,message_id,message_body) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1, message_body=excluded.message_body",
    ).bind(input.id, input.queueName, input.messageId ?? null, input.messageBody).run();
  }

  async list(limit: number): Promise<NotificationDeadLetter[]> {
    const rows = await this.db.prepare(
      "SELECT * FROM notification_dead_letters ORDER BY CASE WHEN status='OPEN' THEN 0 ELSE 1 END, first_seen_at DESC LIMIT ?",
    ).bind(limit).all<Record<string, unknown>>();
    return rows.results.map(mapRow);
  }

  async find(id: string): Promise<NotificationDeadLetter | null> {
    const row = await this.db.prepare("SELECT * FROM notification_dead_letters WHERE id=? LIMIT 1").bind(id).first<Record<string, unknown>>();
    return row ? mapRow(row) : null;
  }

  async markReplayed(id: string, adminId: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE notification_dead_letters SET status='REPLAYED',last_replayed_at=CURRENT_TIMESTAMP,replayed_by=? WHERE id=? AND status='OPEN'",
    ).bind(adminId, id).run();
    return result.meta.changes === 1;
  }
}
