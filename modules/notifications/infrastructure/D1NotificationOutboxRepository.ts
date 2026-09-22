import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationEvent } from "../domain/NotificationEvent";
import type { NotificationOutboxRepository, OutboxRecord } from "../application/NotificationPorts";

function mapRow(row: Record<string, unknown>): OutboxRecord {
  return {
    id: String(row.id),
    eventType: String(row.event_type),
    eventVersion: Number(row.event_version ?? 1),
    aggregateId: String(row.aggregate_id),
    payload: JSON.parse(String(row.payload_json)),
    createdAt: String(row.created_at),
    ...(row.recipients_json && JSON.parse(String(row.recipients_json)).length ? { recipients: JSON.parse(String(row.recipients_json)) } : {}),
    status: String(row.status) as OutboxRecord["status"],
    attempts: Number(row.attempts ?? 0),
    availableAt: String(row.available_at),
  };
}

export class D1NotificationOutboxRepository implements NotificationOutboxRepository {
  constructor(private readonly db: D1Database) {}

  async enqueue(event: NotificationEvent): Promise<boolean> {
    const result = await this.db.prepare(
      "INSERT OR IGNORE INTO notification_outbox (id,event_key,event_type,event_version,aggregate_id,payload_json,recipients_json,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(
      event.id,
      `${event.eventType}:${event.aggregateId}:${event.id}`,
      event.eventType,
      event.eventVersion,
      event.aggregateId,
      JSON.stringify(event.payload),
      JSON.stringify(event.recipients ?? []),
      event.createdAt,
    ).run();
    return Boolean(result.meta.changes);
  }

  async findById(id: string): Promise<OutboxRecord | null> {
    const row = await this.db.prepare(
      "SELECT * FROM notification_outbox WHERE id=? LIMIT 1",
    ).bind(id).first<Record<string, unknown>>();
    return row ? mapRow(row) : null;
  }

  async pending(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.db.prepare(
      "SELECT * FROM notification_outbox WHERE terminal_at IS NULL AND ((status IN ('PENDING','FAILED') AND available_at<=CURRENT_TIMESTAMP) OR (status='QUEUED' AND available_at<=CURRENT_TIMESTAMP)) ORDER BY created_at ASC LIMIT ?",
    ).bind(Math.max(1, Math.min(limit, 100))).all<Record<string, unknown>>();
    return rows.results.map(mapRow);
  }

  async claim(id: string, leaseSeconds: number): Promise<boolean> {
    const lease = Math.max(30, Math.min(Math.trunc(leaseSeconds), 900));
    const result = await this.db.prepare(
      "UPDATE notification_outbox SET status='QUEUED',available_at=datetime('now', '+' || ? || ' seconds') WHERE id=? AND ((status IN ('PENDING','FAILED') AND available_at<=CURRENT_TIMESTAMP) OR (status='QUEUED' AND available_at<=CURRENT_TIMESTAMP))",
    ).bind(lease, id).run();
    return result.meta.changes === 1;
  }

  async markQueued(id: string): Promise<void> {
    await this.db.prepare(
      "UPDATE notification_outbox SET status='QUEUED',available_at=datetime('now','+600 seconds') WHERE id=? AND status='QUEUED'",
    ).bind(id).run();
  }

  async markProcessed(id: string): Promise<void> {
    await this.db.prepare(
      "UPDATE notification_outbox SET status='PROCESSED',processed_at=CURRENT_TIMESTAMP,last_error=NULL,available_at=CURRENT_TIMESTAMP WHERE id=?",
    ).bind(id).run();
  }

  async markFailed(id: string,error:string,retryAt:string): Promise<void> {
    await this.db.prepare(
      "UPDATE notification_outbox SET status='FAILED',attempts=attempts+1,last_error=?,available_at=? WHERE id=? AND status='QUEUED'",
    ).bind(error.slice(0,1000),retryAt,id).run();
  }

  async claimDelivery(input: NotificationDeliveryClaim): Promise<boolean> {
    const lease = Math.max(60, Math.min(Math.trunc(input.leaseSeconds), 1800));
    const token = crypto.randomUUID();
    await this.db.prepare(
      "INSERT OR IGNORE INTO notification_deliveries (id,outbox_id,channel,recipient,template,provider,status,attempts,error_message) VALUES (?,?,?,?,?,?, 'FAILED',0,'CLAIMED')",
    ).bind(crypto.randomUUID(),input.outboxId,input.channel,input.recipient,input.template,"claim").run();
    await this.db.prepare(
      "UPDATE notification_deliveries SET provider='claim',provider_message_id=?,created_at=CURRENT_TIMESTAMP,error_message='CLAIMED' WHERE outbox_id=? AND channel=? AND recipient=? AND template=? AND status='FAILED' AND (provider_message_id IS NULL OR created_at<=datetime('now','-' || ? || ' seconds'))",
    ).bind(token,input.outboxId,input.channel,input.recipient,input.template,lease).run();
    const row = await this.db.prepare(
      "SELECT provider_message_id,status FROM notification_deliveries WHERE outbox_id=? AND channel=? AND recipient=? AND template=? LIMIT 1",
    ).bind(input.outboxId,input.channel,input.recipient,input.template).first<{provider_message_id:string|null;status:string}>();
    return row?.status === "FAILED" && row.provider_message_id === token;
  }

  async hasDelivery(outboxId:string,channel:"EMAIL",recipient:string,template:string): Promise<boolean> {
    const row=await this.db.prepare(
      "SELECT 1 AS found FROM notification_deliveries WHERE outbox_id=? AND channel=? AND recipient=? AND template=? AND status='SENT' LIMIT 1",
    ).bind(outboxId,channel,recipient,template).first<{found:number}>();
    return Boolean(row);
  }

  async recordDelivery(input:Parameters<NotificationOutboxRepository["recordDelivery"]>[0]): Promise<void> {
    await this.db.prepare(
      "UPDATE notification_deliveries SET provider=?,provider_message_id=?,status=?,attempts=?,error_message=?,created_at=CURRENT_TIMESTAMP WHERE outbox_id=? AND channel=? AND recipient=? AND template=?",
    ).bind(input.provider,input.providerMessageId??null,input.status,input.attempts,input.errorMessage??null,input.outboxId,input.channel,input.recipient,input.template).run();
  }
}
