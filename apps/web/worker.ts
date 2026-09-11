// OpenNext owns HTTP routing; this wrapper adds Cloudflare Queue and Scheduled handlers.
// @ts-ignore OpenNext generates this module during build.
import nextWorker from "./.open-next/worker.js";
import type { ExecutionContext, ScheduledEvent } from "@cloudflare/workers-types";
import { D1NotificationOutboxRepository } from "../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import { NotificationService } from "../../modules/notifications/application/NotificationService";
import { ResendEmailProvider } from "../../modules/notifications/infrastructure/ResendEmailProvider";
import type { NotificationEvent } from "../../modules/notifications/domain/NotificationEvent";
import { D1ReservationRepository } from "../../modules/orders/infrastructure/D1ReservationRepository";

type RateLimitBinding = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

type Env = CloudflareEnv & {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_ENV?: string;
  ALLOWED_ORIGIN?: string;
  API_RATE_LIMITER?: RateLimitBinding;
  SENSITIVE_RATE_LIMITER?: RateLimitBinding;
};
type QueueMessage = { body: NotificationEvent | string; ack(): void; retry(): void };
type QueueBatch = { messages: QueueMessage[] };

const SENSITIVE_PREFIXES = [
  "/api/checkout",
  "/api/customer",
  "/api/admin",
  "/api/services",
  "/api/auth",
  "/api/payment",
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
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers: merged});
}

function healthResponse(status: "ok" | "ready", extra: Record<string, unknown> = {}, code = 200): Response {
  return new Response(JSON.stringify({status, service: "ecommerce-iphone-web", timestamp: new Date().toISOString(), ...extra}), {
    status: code,
    headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"},
  });
}

const service = (env: Env) => new NotificationService(
  new D1NotificationOutboxRepository(env.DB),
  new ResendEmailProvider(env.RESEND_API_KEY ?? "", env.EMAIL_FROM ?? ""),
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const id = requestId(request);

    if (url.pathname === "/api/health/live") {
      return withHeaders(healthResponse("ok"), {"X-Request-Id": id});
    }

    if (url.pathname === "/api/health/ready") {
      try {
        await env.DB.prepare("SELECT 1 AS ok").first();
        return withHeaders(healthResponse("ready", {dependencies: {d1: "ok"}}), {"X-Request-Id": id});
      } catch {
        return withHeaders(healthResponse("ready", {dependencies: {d1: "unavailable"}}, 503), {"X-Request-Id": id});
      }
    }

    if (!(await enforceRateLimit(request, env, url.pathname))) {
      return withHeaders(
        new Response(JSON.stringify({error: {code: "RATE_LIMITED", message: "Too many requests."}}), {
          status: 429,
          headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store", "Retry-After": "60"},
        }),
        {"X-Request-Id": id},
      );
    }

    const response = await nextWorker.fetch(request, env, ctx);
    return withHeaders(response, {"X-Request-Id": id});
  },
  async scheduled(_event: ScheduledEvent, env: Env) {
    await new D1ReservationRepository(env.DB).releaseExpired();

    const repo = new D1NotificationOutboxRepository(env.DB);
    const pending = await repo.pending(50);
    for (const event of pending) {
      if (!(await repo.claim(event.id, 300))) continue;
      try {
        await env.EVENTS_QUEUE.send(JSON.stringify(event));
        await repo.markQueued(event.id);
      } catch (error) {
        await repo.markFailed(
          event.id,
          error instanceof Error ? error.message : String(error),
          new Date(Date.now() + 60_000).toISOString().replace("T", " ").replace("Z", ""),
        );
      }
    }
  },
  async queue(batch: QueueBatch, env: Env) {
    const notifications = service(env);
    for (const message of batch.messages) {
      try {
        const event = typeof message.body === "string"
          ? JSON.parse(message.body) as NotificationEvent
          : message.body;
        await notifications.process(event);
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
};
