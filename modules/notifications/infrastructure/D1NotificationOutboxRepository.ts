import type { D1Database } from "@cloudflare/workers-types";
import type { NotificationEvent } from "../domain/NotificationEvent";
import type { NotificationOutboxRepository, OutboxRecord } from "../application/NotificationPorts";

export class D1NotificationOutboxRepository implements NotificationOutboxRepository {
  constructor(private readonly db: D1Database) {}
  async enqueue(event: NotificationEvent): Promise<boolean> {
    const r = await this.db.prepare("INSERT OR IGNORE INTO notification_outbox (id,event_key,event_type,aggregate_id,payload_json,created_at) VALUES (?,?,?,?,?,?)").bind(event.id, `${event.eventType}:${event.aggregateId}:${event.id}`, event.eventType, event.aggregateId, JSON.stringify(event.payload), event.createdAt).run();
    return Boolean(r.meta.changes);
  }
  async pending(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.db.prepare("SELECT * FROM notification_outbox WHERE status IN ('PENDING','FAILED') AND available_at<=CURRENT_TIMESTAMP ORDER BY created_at ASC LIMIT ?").bind(Math.max(1, Math.min(limit, 100))).all<any>();
    return rows.results.map(r => ({ id:r.id,eventType:r.event_type,aggregateId:r.aggregate_id,payload:JSON.parse(r.payload_json),createdAt:r.created_at,status:r.status,attempts:r.attempts,availableAt:r.available_at }));
  }
  async markQueued(id:string){await this.db.prepare("UPDATE notification_outbox SET status='QUEUED' WHERE id=? AND status IN ('PENDING','FAILED')").bind(id).run();}
  async markProcessed(id:string){await this.db.prepare("UPDATE notification_outbox SET status='PROCESSED',processed_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(id).run();}
  async markFailed(id:string,error:string,retryAt:string){await this.db.prepare("UPDATE notification_outbox SET status='FAILED',attempts=attempts+1,last_error=?,available_at=? WHERE id=?").bind(error.slice(0,1000),retryAt,id).run();}
  async hasDelivery(outboxId:string,channel:"EMAIL",recipient:string,template:string){const row=await this.db.prepare("SELECT 1 AS found FROM notification_deliveries WHERE outbox_id=? AND channel=? AND recipient=? AND template=? AND status='SENT' LIMIT 1").bind(outboxId,channel,recipient,template).first<{found:number}>();return Boolean(row);}
  async recordDelivery(input:Parameters<NotificationOutboxRepository["recordDelivery"]>[0]){await this.db.prepare("INSERT INTO notification_deliveries (id,outbox_id,channel,recipient,template,provider,provider_message_id,status,attempts,error_message) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(outbox_id,channel,recipient,template) DO UPDATE SET provider=excluded.provider,provider_message_id=excluded.provider_message_id,status=excluded.status,attempts=excluded.attempts,error_message=excluded.error_message,created_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(),input.outboxId,input.channel,input.recipient,input.template,input.provider,input.providerMessageId??null,input.status,input.attempts,input.errorMessage??null).run();}
}
