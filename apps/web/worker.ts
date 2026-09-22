// OpenNext owns HTTP routing; this wrapper adds Cloudflare Queue, Scheduled and Durable Object handlers.
// @ts-ignore OpenNext generates this module during build.
import nextWorker from "./.open-next/worker.js";
import type { ExecutionContext, MessageBatch, Message, ScheduledEvent } from "@cloudflare/workers-types";
import { D1NotificationOutboxRepository } from "../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import { NotificationHub } from "../../modules/notifications/infrastructure/NotificationHub";
import { notificationProcessingApplication, notificationQueuePublisher } from "./notificationsApplication";
import { D1ReservationRepository } from "../../modules/orders/infrastructure/D1ReservationRepository";
import type { NotificationEvent } from "../../modules/notifications/domain/NotificationEvent";

export { NotificationHub };

type Env = CloudflareEnv & {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_ENV?: string;
  ALLOWED_ORIGIN?: string;
  API_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  SENSITIVE_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
};

type NotificationQueueMessage = Readonly<{
  schemaVersion: number;
  outboxId: string;
}>;

const SENSITIVE_PREFIXES = [
  "/api/checkout",
  "/api/customer",
  "/api/admin",
  "/api/services",
  "/api/auth",
  "/api/payments",
  "/api/notifications",
];

function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function clientKey(request: Request, pathname: string): string {
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  return `${address}:${pathname}`;
}

function sensitive(pathname: string): boolean {
  return SENSITIVE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function enforceRateLimit(request: Request, env: Env, pathname: string): Promise<boolean> {
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/health")) return true;
  const limiter = sensitive(pathname) ? env.SENSITIVE_RATE_LIMITER : env.API_RATE_LIMITER;
  if (!limiter) return env.APP_ENV !== "production";
  const { success } = await limiter.limit({ key: clientKey(request, pathname) });
  return success;
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

function healthResponse(
  status: "ok" | "ready",
  extra: Record<string, unknown> = {},
  code = 200,
): Response {
  return new Response(
    JSON.stringify({
      status,
      service: "ecommerce-iphone-web",
      timestamp: new Date().toISOString(),
      ...extra,
    }),
    {
      status: code,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function parseLegacyNotification(body: unknown): NotificationEvent | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    typeof value.eventType !== "string" ||
    typeof value.aggregateId !== "string" ||
    typeof value.createdAt !== "string" ||
    !value.payload ||
    typeof value.payload !== "object"
  ) {
    return null;
  }
  return {
    id: value.id,
    eventType: value.eventType,
    eventVersion: typeof value.eventVersion === "number" ? value.eventVersion : 1,
    aggregateId: value.aggregateId,
    createdAt: value.createdAt,
    payload: value.payload as Record<string, unknown>,
    ...(Array.isArray(value.recipients) ? { recipients: value.recipients as NotificationEvent["recipients"] } : {}),
  };
}

function parseQueueMessage(body: string): NotificationQueueMessage | null {
  try {
    const value = JSON.parse(body) as Partial<NotificationQueueMessage>;
    if (
      typeof value.outboxId !== "string" ||
      typeof value.schemaVersion !== "number"
    ) return null;
    return { outboxId: value.outboxId, schemaVersion: value.schemaVersion };
  } catch {
    return null;
  }
}

async function processNotificationMessage(
  message: Message<string>,
  env: Env,
  allowLegacyEvent: boolean,
): Promise<void> {
  const service = notificationProcessingApplication(env);
  const parsed = parseQueueMessage(message.body);

  if (parsed) {
    if (parsed.schemaVersion !== 1) throw new Error("UNSUPPORTED_NOTIFICATION_SCHEMA");
    await service.processByOutboxId(parsed.outboxId);
    message.ack();
    return;
  }

  if (!allowLegacyEvent) throw new Error("INVALID_NOTIFICATION_QUEUE_MESSAGE");

  const legacy = parseLegacyNotification(message.body);
  if (!legacy) throw new Error("INVALID_LEGACY_NOTIFICATION_EVENT");
  await service.process(legacy);
  message.ack();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const id = requestId(request);

    if (url.pathname === "/api/health/live") {
      return withHeaders(healthResponse("ok"), { "X-Request-Id": id });
    }

    if (url.pathname === "/api/health/ready") {
      try {
        await env.DB.prepare("SELECT 1 AS ok").first();
        return withHeaders(
          healthResponse("ready", { dependencies: { d1: "ok", notifications: "configured" } }),
          { "X-Request-Id": id },
        );
      } catch {
        return withHeaders(
          healthResponse(
            "ready",
            { dependencies: { d1: "unavailable" } },
            503,
          ),
          { "X-Request-Id": id },
        );
      }
    }

    if (!(await enforceRateLimit(request, env, url.pathname))) {
      return withHeaders(
        new Response(
          JSON.stringify({
            error: { code: "RATE_LIMITED", message: "Too many requests." },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
              "Retry-After": "60",
            },
          },
        ),
        { "X-Request-Id": id },
      );
    }

    const response = await nextWorker.fetch(request, env, ctx);
    return withHeaders(response, { "X-Request-Id": id });
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    await new D1ReservationRepository(env.DB).releaseExpired();

    const repo = new D1NotificationOutboxRepository(env.DB);
    const publisher = notificationQueuePublisher(env);
    const pending = await repo.pending(50);

    for (const event of pending) {
      if (!(await repo.claim(event.id, 300))) continue;
      try {
        await publisher.publish(event);
        await repo.markQueued(event.id);
      } catch (error) {
        await repo.markFailed(
          event.id,
          error instanceof Error ? error.message : String(error),
          new Date(Date.now() + 60_000)
            .toISOString()
            .replace("T", " ")
            .replace("Z", ""),
        );
      }
    }
  },

  async queue(batch: MessageBatch<string>, env: Env) {
    for (const message of batch.messages) {
      try {
        await processNotificationMessage(
          message,
          env,
          batch.queue === "ecommerce-iphone-events",
        );
      } catch {
        message.retry();
      }
    }
  },
};
