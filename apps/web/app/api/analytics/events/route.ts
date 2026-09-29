import { NextResponse } from "next/server";
import { cloudflareEnv } from "../../../lib/cloudflareContext";
import { analyticsApplication } from "@modules/analytics/infrastructure/analyticsComposition";
import { isAnalyticsEventType, type AnalyticsPayload } from "@modules/analytics/domain/AnalyticsEvent";

const MAX_BODY_BYTES = 16_384;

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}

function parsePayload(value: unknown): AnalyticsPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_ANALYTICS_PAYLOAD");
  const payload = value as Record<string, unknown>;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(payload)) {
    if (!/^[A-Za-z][A-Za-z0-9_:-]{0,63}$/.test(key)) throw new Error("INVALID_ANALYTICS_PAYLOAD");
    if (item !== null && typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
      throw new Error("INVALID_ANALYTICS_PAYLOAD");
    }
    result[key] = item;
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_ANALYTICS_EVENT");
    const body = parsed as Record<string, unknown>;
    if (!isAnalyticsEventType(body.eventType)) throw new Error("INVALID_ANALYTICS_EVENT_TYPE");

    const sessionId = validId(body.sessionId) ? body.sessionId : crypto.randomUUID();
    const visitorId = validId(body.visitorId) ? body.visitorId : crypto.randomUUID();
    const eventId = validId(body.eventId) ? body.eventId : crypto.randomUUID();
    const occurredAt = typeof body.occurredAt === "string" ? body.occurredAt : new Date().toISOString();
    const requestId = request.headers.get("x-request-id")?.trim() || undefined;

    await analyticsApplication(cloudflareEnv().ANALYTICS_QUEUE).record({
      eventId,
      eventType: body.eventType,
      occurredAt,
      sessionId,
      visitorId,
      ...(requestId === undefined ? {} : { requestId }),
      payload: parsePayload(body.payload ?? {}),
    });

    return NextResponse.json({ accepted: true, eventId, sessionId, visitorId }, {
      status: 202,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "INVALID_ANALYTICS_EVENT_TYPE" || code === "INVALID_ANALYTICS_EVENT" || code === "INVALID_ANALYTICS_PAYLOAD" ? 400 : code === "ANALYTICS_SENSITIVE_FIELD" || code === "ANALYTICS_PAYLOAD_TOO_LARGE" ? 422 : 400;
    return NextResponse.json({ error: status === 400 ? "Invalid analytics event" : "Analytics payload rejected" }, { status });
  }
}
