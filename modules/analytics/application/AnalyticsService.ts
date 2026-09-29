import { isAnalyticsEventType, type AnalyticsEvent, type AnalyticsPayload } from "../domain/AnalyticsEvent";
import type { AnalyticsPort } from "./AnalyticsPort";

const MAX_PAYLOAD_BYTES = 8192;
const FORBIDDEN_KEYS = new Set([
  "password","passwd","token","secret","authorization","cookie","set-cookie",
  "email","phone","address","name","fullName","firstName","lastName",
  "card","cardNumber","cvv","cvc","expiry","iban","imei","serial","apiKey",
]);

function assertIdentifier(value: string, field: string): void {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw new Error(`INVALID_ANALYTICS_${field.toUpperCase()}`);
}
function assertPayload(payload: AnalyticsPayload): void {
  for (const key of Object.keys(payload)) if (FORBIDDEN_KEYS.has(key)) throw new Error("ANALYTICS_SENSITIVE_FIELD");
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error("ANALYTICS_PAYLOAD_TOO_LARGE");
  }
}
export class AnalyticsService {
  constructor(private readonly port: AnalyticsPort) {}
  async record(input: {
    eventId: string; eventType: unknown; occurredAt: string;
    sessionId: string; visitorId: string; requestId?: string | undefined; payload: AnalyticsPayload;
  }): Promise<void> {
    assertIdentifier(input.eventId, "event_id");
    if (!isAnalyticsEventType(input.eventType)) throw new Error("INVALID_ANALYTICS_EVENT_TYPE");
    assertIdentifier(input.sessionId, "session_id");
    assertIdentifier(input.visitorId, "visitor_id");
    assertPayload(input.payload);
    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new Error("INVALID_ANALYTICS_OCCURRED_AT");
    await this.port.record({
      ...input, eventVersion: 1, occurredAt: occurredAt.toISOString(),
      receivedAt: new Date().toISOString(), source: "web",
    });
  }
}
