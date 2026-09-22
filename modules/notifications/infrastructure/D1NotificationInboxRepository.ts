import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationInboxItem, NotificationRecipient } from "../domain/NotificationEvent";
import type { NotificationInboxRepository } from "../application/NotificationInboxRepository";

function encodeCursor(item: NotificationInboxItem): string {
  return btoa(`${item.createdAt}|${item.id}`);
}

function decodeCursor(value?: string): { createdAt: string; id: string } | null {
  if (!value) return null;
  try {
    const decoded = atob(value);
    const separator = decoded.indexOf("|");
    if (separator <= 0) return null;
    return {
      createdAt: decoded.slice(0, separator),
      id: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function mapRow(row: Record<string, unknown>): NotificationInboxItem {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventType: String(row.event_type),
    eventVersion: Number(row.event_version ?? 1),
    recipientType: String(row.recipient_type) as NotificationRecipient["type"],
    recipientId: String(row.recipient_id),
    title: String(row.title),
    body: String(row.body),
    payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    createdAt: String(row.created_at),
    ...(row.read_at ? { readAt: String(row.read_at) } : {}),
    ...(row.expires_at ? { expiresAt: String(row.expires_at) } : {}),
  };
}

export class D1NotificationInboxRepository implements NotificationInboxRepository {
  constructor(private readonly db: D1Database) {}

  async create(item: NotificationInboxItem): Promise<boolean> {
    const result = await this.db.prepare(
      "INSERT OR IGNORE INTO notification_inbox (id,event_id,event_type,event_version,recipient_type,recipient_id,title,body,payload_json,created_at,read_at,expires_at,dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      item.id,
      item.eventId,
      item.eventType,
      item.eventVersion,
      item.recipientType,
      item.recipientId,
      item.title,
      item.body,
      JSON.stringify(item.payload),
      item.createdAt,
      item.readAt ?? null,
      item.expiresAt ?? null,
      `${item.eventId}:${item.recipientType}:${item.recipientId}`,
    ).run();
    return Boolean(result.meta.changes);
  }

  async list(
    recipient: NotificationRecipient,
    limit: number,
    cursor?: string,
    unreadOnly = false,
  ): Promise<{ items: NotificationInboxItem[]; nextCursor: string | null }> {
    const normalized = Math.min(Math.max(limit, 1), 100);
    const decoded = decodeCursor(cursor);
    const conditions = [
      "recipient_type=?",
      "recipient_id=?",
      "(expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)",
    ];
    const binds: (string | number)[] = [recipient.type, recipient.id];

    if (unreadOnly) conditions.push("read_at IS NULL");
    if (decoded) {
      conditions.push("(created_at<? OR (created_at=? AND id<?))");
      binds.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }

    const rows = await this.db.prepare(
      "SELECT * FROM notification_inbox WHERE " +
      conditions.join(" AND ") +
      " ORDER BY created_at DESC, id DESC LIMIT ?",
    ).bind(...binds, normalized + 1).all<Record<string, unknown>>();

    const hasMore = rows.results.length > normalized;
    const items = rows.results.slice(0, normalized).map(mapRow);
    return {
      items,
      nextCursor: hasMore && items.length ? encodeCursor(items[items.length - 1]) : null,
    };
  }

  async unreadCount(recipient: NotificationRecipient): Promise<number> {
    const row = await this.db.prepare(
      "SELECT COUNT(*) AS count FROM notification_inbox WHERE recipient_type=? AND recipient_id=? AND read_at IS NULL AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)",
    ).bind(recipient.type, recipient.id).first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async markRead(recipient: NotificationRecipient, notificationId: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE notification_inbox SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND recipient_type=? AND recipient_id=?",
    ).bind(notificationId, recipient.type, recipient.id).run();
    return result.meta.changes === 1;
  }

  async markAllRead(recipient: NotificationRecipient): Promise<number> {
    const result = await this.db.prepare(
      "UPDATE notification_inbox SET read_at=CURRENT_TIMESTAMP WHERE recipient_type=? AND recipient_id=? AND read_at IS NULL",
    ).bind(recipient.type, recipient.id).run();
    return result.meta.changes;
  }
}
