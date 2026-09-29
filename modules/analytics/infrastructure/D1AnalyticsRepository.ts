import type { D1Database } from "@cloudflare/workers-types";
import type { AnalyticsEvent } from "../domain/AnalyticsEvent";
import type { AnalyticsPort } from "../application/AnalyticsPort";

export class D1AnalyticsRepository implements AnalyticsPort {
  constructor(private readonly db: D1Database) {}
  async record(event: AnalyticsEvent): Promise<void> {
    await this.db.prepare(
      "INSERT OR IGNORE INTO analytics_events (event_id,event_type,event_version,occurred_at,received_at,session_id,visitor_id,request_id,source,payload_json,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now','+180 days'))",
    ).bind(event.eventId,event.eventType,event.eventVersion,event.occurredAt,event.receivedAt,
      event.sessionId,event.visitorId,event.requestId ?? null,event.source,JSON.stringify(event.payload)).run();
  }
  async purgeExpired(limit = 500): Promise<number> {
    const result = await this.db.prepare(
      "DELETE FROM analytics_events WHERE event_id IN (SELECT event_id FROM analytics_events WHERE expires_at<=CURRENT_TIMESTAMP LIMIT ?)",
    ).bind(Math.max(1, Math.min(Math.trunc(limit), 5000))).run();
    return result.meta.changes;
  }
}
