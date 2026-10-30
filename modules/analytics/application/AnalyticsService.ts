import {
  isAnalyticsEventType,
  isServerOwnedAnalyticsEventType,
  type AnalyticsEvent,
  type AnalyticsPayload,
} from "../domain/AnalyticsEvent";
import type { AnalyticsPort } from "./AnalyticsPort";

const MAX_PAYLOAD_BYTES = 8192;
const FORBIDDEN_KEYS = new Set([
  "password",
  "passwd",
  "token",
  "secret",
  "authorization",
  "cookie",
  "set-cookie",
  "email",
  "phone",
  "address",
  "name",
  "fullName",
  "firstName",
  "lastName",
  "card",
  "cardNumber",
  "cvv",
  "cvc",
  "expiry",
  "iban",
  "imei",
  "serial",
  "apiKey",
]);

function assertIdentifier(value: string, field: string): void {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    throw new Error(`INVALID_ANALYTICS_${field.toUpperCase()}`);
  }
}

function assertPayload(payload: AnalyticsPayload): void {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error("ANALYTICS_SENSITIVE_FIELD");
    }
  }
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error("ANALYTICS_PAYLOAD_TOO_LARGE");
  }
}

export class AnalyticsService {
  constructor(private readonly port: AnalyticsPort) {}

  async record(input: {
    eventId: string;
    eventType: unknown;
    occurredAt: string;
    sessionId: string;
    visitorId: string;
    requestId?: string | undefined;
    payload: AnalyticsPayload;
    source?: "web" | "server" | undefined;
  }): Promise<void> {
    assertIdentifier(input.eventId, "event_id");
    const eventType = input.eventType;
    if (!isAnalyticsEventType(eventType)) {
      throw new Error("INVALID_ANALYTICS_EVENT_TYPE");
    }
    if (isServerOwnedAnalyticsEventType(eventType) && input.source !== "server") {
      throw new Error("SERVER_OWNED_ANALYTICS_EVENT");
    }
    assertIdentifier(input.sessionId, "session_id");
    assertIdentifier(input.visitorId, "visitor_id");
    assertPayload(input.payload);
    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new Error("INVALID_ANALYTICS_OCCURRED_AT");
    }

    const event: AnalyticsEvent = {
      eventId: input.eventId,
      eventType,
      occurredAt: occurredAt.toISOString(),
      receivedAt: new Date().toISOString(),
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      source: input.source ?? "web",
      eventVersion: 1,
      payload: input.payload,
    };
    await this.port.record(event);
  }
}
