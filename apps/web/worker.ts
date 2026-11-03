// OpenNext owns HTTP routing; this wrapper adds Cloudflare Queue, Scheduled and Durable Object handlers.
// @ts-ignore OpenNext generates this module during build.
import nextWorker from "./.open-next/worker.js";
import type {
  ExecutionContext,
  MessageBatch,
  Message,
  ScheduledEvent,
} from "@cloudflare/workers-types";
import { D1NotificationOutboxRepository } from "../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import { DurableObject } from "cloudflare:workers";
import {
  notificationDeadLetterApplication,
  notificationProcessingApplication,
  notificationQueuePublisher,
} from "./lib/notificationsApplication";
import { seoManagementApplication } from "./lib/seoApplication";
import { D1ReservationRepository } from "../../modules/orders/infrastructure/D1ReservationRepository";
import { analyticsPersistence } from "../../modules/analytics/infrastructure/analyticsComposition";
import { webVitalsApp } from "./lib/analyticsApplication";
import { revenueAnalyticsApp } from "./lib/analyticsApplication";
import type { AnalyticsEvent } from "../../modules/analytics/domain/AnalyticsEvent";
import { NotificationTerminalError } from "../../modules/notifications/application/NotificationProcessingError";
import type {
  NotificationEvent,
  NotificationInboxItem,
} from "../../modules/notifications/domain/NotificationEvent";
import { mediaKeyFromUrl } from "../../modules/shared-kernel/MediaReference";
import { logServerError, logServerMetric } from "./server/serverLogger";
import { classifyRateLimitPath, normalizeOperationalRoute } from "./lib/operationalTelemetry";
import { isValidRequestId, resolveRequestId } from "./lib/requestCorrelation";
import { resolveQueueCorrelation } from "./lib/queueCorrelation";
import { SECURITY_RESPONSE_HEADERS } from "./lib/securityHeaders";
import {
  isAllowedProductionMonitorRequest,
  isWorkersDevHostname,
  verifyGitHubActionsMonitorToken,
} from "./lib/githubActionsMonitorAccess";

export class NotificationHub extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/publish") {
      const item = (await request.json()) as NotificationInboxItem;
      const message = JSON.stringify({
        type: "notification",
        notificationId: item.id,
        eventId: item.eventId,
        eventType: item.eventType,
        eventVersion: item.eventVersion,
        createdAt: item.createdAt,
        title: item.title,
        body: item.body,
        data: item.payload,
      });

      for (const websocket of this.ctx.getWebSockets()) {
        try {
          websocket.send(message);
        } catch {
          try {
            websocket.close(1011, "Delivery failed");
          } catch {}
        }
      }

      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(_websocket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;

    try {
      const payload = JSON.parse(message) as { type?: string };
      if (payload.type === "ping" || payload.type === "ack") return;
    } catch {
      return;
    }
  }

  webSocketClose(websocket: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    try {
      websocket.close();
    } catch {}
  }

  webSocketError(websocket: WebSocket): void {
    try {
      websocket.close(1011, "Socket error");
    } catch {}
  }
}

type Env = CloudflareEnv & {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_ENV?: string;
  ALLOWED_ORIGIN?: string;
  API_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  SENSITIVE_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
};

type AnalyticsQueueMessage = Readonly<{
  kind: "analytics";
  schemaVersion: 1;
  event: AnalyticsEvent;
}>;

type NotificationQueueMessage = Readonly<{
  schemaVersion: number;
  outboxId: string;
  requestId?: string | undefined;
}>;

function clientKey(request: Request, pathname: string): string {
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  return `${address}:${normalizeOperationalRoute(pathname)}`;
}

async function enforceRateLimit(request: Request, env: Env, pathname: string): Promise<boolean> {
  const tier = classifyRateLimitPath(pathname);
  if (tier === "none") return true;
  const limiter = tier === "sensitive" ? env.SENSITIVE_RATE_LIMITER : env.API_RATE_LIMITER;
  if (!limiter) return env.APP_ENV !== "production";
  const { success } = await limiter.limit({ key: clientKey(request, pathname) });
  return success;
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_RESPONSE_HEADERS)) {
    if (!merged.has(key)) merged.set(key, value);
  }
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

function healthResponse(
  status: "ok" | "ready" | "not_ready",
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

type DependencyStatus = "ok" | "configured" | "unavailable";

async function checkDependency(
  name: string,
  probe: () => Promise<boolean>,
  environment: string,
): Promise<"ok" | "unavailable"> {
  try {
    return (await probe()) ? "ok" : "unavailable";
  } catch (error) {
    logServerError("health.readiness_dependency", error, {
      component: "health",
      environment,
      dependency: name,
      outcome: "unavailable",
    });
    return "unavailable";
  }
}

async function checkReadiness(env: Env): Promise<{
  ready: boolean;
  dependencies: Record<string, DependencyStatus>;
}> {
  const [d1, r2, notificationHub] = await Promise.all([
    checkDependency("d1", async () => {
      const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return row?.ok === 1;
    }, env.APP_ENV ?? "unknown"),
    checkDependency("r2", async () => {
      await env.MEDIA_BUCKET.list({ limit: 1 });
      return true;
    }, env.APP_ENV ?? "unknown"),
    checkDependency("notification_hub", async () => {
      if (!env.NOTIFICATION_HUB) return false;
      const namespace = env.NOTIFICATION_HUB;
      const stub = namespace.get(namespace.idFromName("readiness"));
      const response = await stub.fetch("https://notification-hub/healthz");
      return response.ok;
    }, env.APP_ENV ?? "unknown"),
  ]);

  // Queue bindings expose no non-mutating health API. Their status is explicitly
  // reported as configured, not as a claim that the remote queue is consuming.
  const dependencies: Record<string, DependencyStatus> = {
    d1,
    r2,
    eventsQueue: env.EVENTS_QUEUE ? "configured" : "unavailable",
    notificationsQueue: env.NOTIFICATIONS_QUEUE ? "configured" : "unavailable",
    notificationsDlqQueue: env.NOTIFICATIONS_DLQ_QUEUE ? "configured" : "unavailable",
    notificationHub,
  };
  const ready = Object.values(dependencies).every(
    (status) => status === "ok" || status === "configured",
  );
  return { ready, dependencies };
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
    ...(Array.isArray(value.recipients)
      ? { recipients: value.recipients as NotificationEvent["recipients"] }
      : {}),
  };
}

function parseQueueMessage(body: string): NotificationQueueMessage | null {
  try {
    const value = JSON.parse(body) as Partial<NotificationQueueMessage>;
    if (typeof value.outboxId !== "string" || typeof value.schemaVersion !== "number") return null;
    return {
      outboxId: value.outboxId,
      schemaVersion: value.schemaVersion,
      ...(isValidRequestId(value.requestId) ? { requestId: value.requestId.trim() } : {}),
    };
  } catch {
    return null;
  }
}

function parseAnalyticsMessage(body: string): AnalyticsQueueMessage | null {
  try {
    const value = JSON.parse(body) as Partial<AnalyticsQueueMessage>;
    if (value.kind !== "analytics" || value.schemaVersion !== 1 || !value.event) return null;
    return value as AnalyticsQueueMessage;
  } catch {
    return null;
  }
}

function queueCorrelationId(body: string, fallback?: string): string | undefined {
  const analytics = parseAnalyticsMessage(body);
  if (analytics) {
    return resolveQueueCorrelation(
      {
        requestId: analytics.event.requestId,
        eventId: analytics.event.eventId,
      },
      fallback,
    );
  }
  const notification = parseQueueMessage(body);
  return resolveQueueCorrelation(
    { requestId: notification?.requestId, outboxId: notification?.outboxId },
    fallback,
  );
}

async function processAnalyticsMessage(message: Message<string>, env: Env): Promise<void> {
  const parsed = parseAnalyticsMessage(message.body);
  if (!parsed) throw new Error("INVALID_ANALYTICS_QUEUE_MESSAGE");
  await analyticsPersistence(env.DB).record(parsed.event);
  message.ack();
}

async function processMediaCleanup(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    "SELECT object_key,attempts FROM media_cleanup_queue WHERE available_at<=CURRENT_TIMESTAMP ORDER BY created_at ASC LIMIT 100",
  ).all<{ object_key: string; attempts: number }>();
  for (const row of rows.results) await cleanupMediaKey(env, row.object_key, row.attempts);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const prefix of [
    "product-images/",
    "category-images/",
    "service-images/",
    "home-carousel/",
  ]) {
    const listed = await env.MEDIA_BUCKET.list({ prefix, limit: 1000 });
    for (const object of listed.objects) {
      if (object.uploaded.getTime() > cutoff) continue;
      await cleanupMediaKey(env, object.key, 0);
    }
  }
}

async function cleanupMediaKey(env: Env, key: string, attempts: number): Promise<void> {
  if (!mediaKeyFromUrl("/api/media/" + key)) return;
  const url = "/api/media/" + key;
  const referenced = await env.DB.prepare(
    "SELECT CASE WHEN EXISTS (SELECT 1 FROM product_images WHERE url=?) OR EXISTS (SELECT 1 FROM categories WHERE image_url=?) OR EXISTS (SELECT 1 FROM service_types WHERE image_url=?) OR EXISTS (SELECT 1 FROM cms_blog_posts WHERE cover_image_url=?) OR EXISTS (SELECT 1 FROM marketing_banners WHERE image_url=?) OR EXISTS (SELECT 1 FROM seo_route_overrides WHERE og_image_url=?) OR EXISTS (SELECT 1 FROM cms_pages WHERE content LIKE ?) OR EXISTS (SELECT 1 FROM cms_landing_pages WHERE content LIKE ?) THEN 1 ELSE 0 END AS referenced",
  )
    .bind(url, url, url, url, url, url, "%" + url + "%", "%" + url + "%")
    .first<{ referenced: number }>();
  if (Number(referenced?.referenced ?? 0) === 1) {
    await env.DB.prepare("DELETE FROM media_cleanup_queue WHERE object_key=?").bind(key).run();
    return;
  }
  try {
    await env.MEDIA_BUCKET.delete(key);
    await env.DB.prepare("DELETE FROM media_cleanup_queue WHERE object_key=?").bind(key).run();
  } catch (error) {
    const nextAttempts = attempts + 1;
    const delay = Math.min(3600, 2 ** Math.min(nextAttempts, 10));
    await env.DB.prepare(
      "INSERT INTO media_cleanup_queue(object_key,attempts,available_at,last_error,updated_at) VALUES(?,?,datetime('now','+'||?||' seconds'),?,CURRENT_TIMESTAMP) ON CONFLICT(object_key) DO UPDATE SET attempts=excluded.attempts,available_at=excluded.available_at,last_error=excluded.last_error,updated_at=CURRENT_TIMESTAMP",
    )
      .bind(key, nextAttempts, delay, error instanceof Error ? error.message : String(error))
      .run();
  }
}
async function recordAbandonedCarts(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    "SELECT c.id,c.updated_at,COUNT(ci.product_id) AS item_count FROM carts c INNER JOIN cart_items ci ON ci.cart_id=c.id WHERE c.updated_at<=datetime('now','-30 minutes') GROUP BY c.id,c.updated_at LIMIT 200",
  ).all<{ id: string; updated_at: string; item_count: number }>();

  const analytics = analyticsPersistence(env.DB);
  for (const row of rows.results) {
    const occurredAt = new Date(row.updated_at).toISOString();
    await analytics.record({
      eventId: `cart-abandoned:${row.id}:${row.updated_at}`,
      eventType: "CartAbandoned",
      occurredAt,
      receivedAt: new Date().toISOString(),
      sessionId: `cart:${row.id}`,
      visitorId: `cart:${row.id}`,
      source: "server",
      eventVersion: 1,
      payload: {
        cartId: row.id,
        itemCount: Number(row.item_count),
        abandonmentMinutes: Math.max(
          30,
          Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 60000),
        ),
      },
    });
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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const startedAt = Date.now();
    const route = normalizeOperationalRoute(url.pathname);
    let id = resolveRequestId(request.headers);

    const recordResponse = (response: Response): Response => {
      logServerMetric("http.request", {
        component: "cloudflare-worker",
        environment: env.APP_ENV ?? "unknown",
        requestId: id,
        method: request.method,
        route,
        status: response.status,
        durationMs: Math.max(0, Date.now() - startedAt),
        outcome: response.status >= 500 ? "error" : response.status >= 400 ? "rejected" : "success",
      });
      return response;
    };

    try {
      // The workers.dev hostname is a restricted CI-only path around the
      // zone-level WAF. It can expose only the exact probe routes allowed by
      // a short-lived GitHub Actions OIDC token; all other traffic is hidden.
      if (isWorkersDevHostname(url.hostname)) {
        const claims = await verifyGitHubActionsMonitorToken(request.headers.get("authorization"));
        if (!claims || !(await isAllowedProductionMonitorRequest(request, claims))) {
          return recordResponse(
            withHeaders(new Response("Not found", { status: 404 }), { "X-Request-Id": id }),
          );
        }

        // Do not forward the GitHub OIDC bearer token into Next.js application
        // handlers after the Worker has validated it.
        const forwardedHeaders = new Headers(request.headers);
        forwardedHeaders.delete("authorization");
        request = new Request(request, { headers: forwardedHeaders });
      }

      if (url.pathname === "/api/health/live") {
        return recordResponse(withHeaders(healthResponse("ok"), { "X-Request-Id": id }));
      }

      if (url.pathname === "/api/health/ready") {
        const readiness = await checkReadiness(env);
        return recordResponse(
          withHeaders(
            healthResponse(
              readiness.ready ? "ready" : "not_ready",
              { ready: readiness.ready, dependencies: readiness.dependencies },
              readiness.ready ? 200 : 503,
            ),
            { "X-Request-Id": id },
          ),
        );
      }

      if (!(await enforceRateLimit(request, env, url.pathname))) {
        return recordResponse(
          withHeaders(
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
          ),
        );
      }

      const response = await nextWorker.fetch(request, env, ctx);
      const middlewareRequestId = response.headers.get("X-Request-Id");
      if (isValidRequestId(middlewareRequestId)) id = middlewareRequestId.trim();

      if (
        (request.method === "GET" || request.method === "HEAD") &&
        response.status === 404 &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/_next/")
      ) {
        const redirect = await seoManagementApplication(env).resolveRedirect(url.pathname);
        if (redirect?.statusCode === 301 && redirect.targetUrl) {
          return recordResponse(
            withHeaders(
              new Response(null, {
                status: 301,
                headers: { Location: redirect.targetUrl, "Cache-Control": "public, max-age=3600" },
              }),
              { "X-Request-Id": id },
            ),
          );
        }
        if (redirect?.statusCode === 410) {
          return recordResponse(
            withHeaders(
              new Response(null, {
                status: 410,
                headers: { "Cache-Control": "public, max-age=300" },
              }),
              { "X-Request-Id": id },
            ),
          );
        }
      }

      const publicContentResponse =
        response.status === 200 &&
        (url.pathname === "/api/content" || url.pathname.startsWith("/api/content/"));
      return recordResponse(
        withHeaders(
          response,
          publicContentResponse
            ? {
                "X-Request-Id": id,
                "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
              }
            : { "X-Request-Id": id },
        ),
      );
    } catch (error) {
      logServerError("http.request", error, {
        component: "cloudflare-worker",
        environment: env.APP_ENV ?? "unknown",
        requestId: id,
        method: request.method,
        route,
        outcome: "failed",
      });
      return recordResponse(
        withHeaders(
          new Response(
            JSON.stringify({
              error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." },
            }),
            {
              status: 500,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
              },
            },
          ),
          { "X-Request-Id": id },
        ),
      );
    }
  },

  async scheduled(event: ScheduledEvent, env: Env) {
    const correlationId = `scheduled:${event.scheduledTime}`;
    const startedAt = Date.now();
    try {
      const now = new Date().toISOString();
      await processMediaCleanup(env);
      await analyticsPersistence(env.DB).purgeExpired(500);
      await webVitalsApp(env).purgeExpired(500);
      await revenueAnalyticsApp(env).reconcile(500);
      await recordAbandonedCarts(env);
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE cms_blog_posts SET status='PUBLISHED',published_at=scheduled_at,updated_at=CURRENT_TIMESTAMP WHERE status='SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at<=?",
        ).bind(now),
        env.DB.prepare(
          "UPDATE cms_landing_pages SET status='PUBLISHED',published_at=scheduled_at,updated_at=CURRENT_TIMESTAMP WHERE status='SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at<=?",
        ).bind(now),
      ]);
      await new D1ReservationRepository(env.DB).releaseExpired();

      const repo = new D1NotificationOutboxRepository(env.DB);
      const publisher = notificationQueuePublisher(env);
      const pending = await repo.pending(50);

      for (const outboxEvent of pending) {
        if (!(await repo.claim(outboxEvent.id, 300))) continue;
        try {
          await publisher.publish(outboxEvent);
          await repo.markQueued(outboxEvent.id);
          logServerMetric("queue.publish.notification", {
            component: "cloudflare-worker",
            environment: env.APP_ENV ?? "unknown",
            queue: "ecommerce-iphone-events",
            outcome: "published",
          });
        } catch (error) {
          logServerMetric("queue.publish.notification", {
            component: "cloudflare-worker",
            environment: env.APP_ENV ?? "unknown",
            queue: "ecommerce-iphone-events",
            outcome: "retry",
          });
          logServerError("queue.publish.notification", error, {
            component: "cloudflare-worker",
            environment: env.APP_ENV ?? "unknown",
            queue: "ecommerce-iphone-events",
            correlationId: outboxEvent.id,
            outcome: "retry",
          });
          await repo.markFailed(
            outboxEvent.id,
            error instanceof Error ? error.message : String(error),
            new Date(Date.now() + 60_000).toISOString().replace("T", " ").replace("Z", ""),
          );
        }
      }
      logServerMetric("scheduled.run", {
        component: "cloudflare-worker",
        environment: env.APP_ENV ?? "unknown",
        schedule: event.cron,
        durationMs: Math.max(0, Date.now() - startedAt),
        pendingOutboxBatchSize: pending.length,
        outcome: "success",
      });
    } catch (error) {
      logServerError("scheduled.run", error, {
        component: "cloudflare-worker",
        environment: env.APP_ENV ?? "unknown",
        schedule: event.cron,
        correlationId,
        outcome: "failed",
      });
      logServerMetric("scheduled.run", {
        component: "cloudflare-worker",
        environment: env.APP_ENV ?? "unknown",
        schedule: event.cron,
        durationMs: Math.max(0, Date.now() - startedAt),
        outcome: "failed",
      });
      throw error;
    }
  },

  async queue(batch: MessageBatch<string>, env: Env) {
    if (batch.queue === "ecommerce-iphone-events") {
      const metrics = { acknowledged: 0, retried: 0, deadLettered: 0 };
      for (const message of batch.messages) {
        try {
          const analytics = parseAnalyticsMessage(message.body);
          if (analytics) {
            await processAnalyticsMessage(message, env);
            metrics.acknowledged += 1;
            continue;
          }
          await processNotificationMessage(message, env, true);
          metrics.acknowledged += 1;
        } catch (error) {
          const queueMessageId = (message as Message<string> & { id?: string }).id;
          const correlationId = queueCorrelationId(message.body, queueMessageId);
          const terminal = error instanceof NotificationTerminalError;
          logServerError("queue.consume", error, {
            component: "cloudflare-worker",
            environment: env.APP_ENV ?? "unknown",
            queue: batch.queue,
            correlationId,
            messageId: queueMessageId,
            outcome: terminal ? "dead_letter" : "retry",
          });
          if (terminal) {
            await env.NOTIFICATIONS_DLQ_QUEUE.send(message.body);
            message.ack();
            metrics.deadLettered += 1;
            continue;
          }
          message.retry();
          metrics.retried += 1;
        }
      }
      logServerMetric("queue.batch", {
        component: "cloudflare-worker",
        environment: env.APP_ENV ?? "unknown",
        queue: batch.queue,
        batchSize: batch.messages.length,
        ...metrics,
        outcome:
          metrics.retried > 0 ? "partial" : metrics.deadLettered > 0 ? "dead_lettered" : "success",
      });
      return;
    }

    if (batch.queue === "ecommerce-iphone-notifications-dlq") {
      const deadLetters = notificationDeadLetterApplication(env);
      const metrics = { acknowledged: 0, retried: 0, deadLettered: 0 };
      for (const message of batch.messages) {
        const raw = message as Message<string> & { id?: string };
        try {
          await deadLetters.record({
            id: raw.id ?? crypto.randomUUID(),
            queueName: batch.queue,
            ...(raw.id ? { messageId: raw.id } : {}),
            messageBody: raw.body,
          });
          message.ack();
          metrics.acknowledged += 1;
        } catch (error) {
          logServerError("queue.consume.dead_letter", error, {
            component: "cloudflare-worker",
            environment: env.APP_ENV ?? "unknown",
            queue: batch.queue,
            correlationId: raw.id,
            messageId: raw.id,
            outcome: "retry",
          });
          message.retry();
          metrics.retried += 1;
        }
      }
      logServerMetric("queue.batch", {
        component: "cloudflare-worker",
        environment: env.APP_ENV ?? "unknown",
        queue: batch.queue,
        batchSize: batch.messages.length,
        ...metrics,
        outcome: metrics.retried > 0 ? "partial" : "success",
      });
      return;
    }

    const metrics = { acknowledged: 0, retried: 0, deadLettered: 0 };
    for (const message of batch.messages) {
      try {
        await processNotificationMessage(message, env, batch.queue === "ecommerce-iphone-events");
        metrics.acknowledged += 1;
      } catch (error) {
        const queueMessageId = (message as Message<string> & { id?: string }).id;
        const correlationId = queueCorrelationId(message.body, queueMessageId);
        const terminal = error instanceof NotificationTerminalError;
        logServerError("queue.consume", error, {
          component: "cloudflare-worker",
          environment: env.APP_ENV ?? "unknown",
          queue: batch.queue,
          correlationId,
          messageId: queueMessageId,
          outcome: terminal ? "dead_letter" : "retry",
        });
        if (terminal) {
          await env.NOTIFICATIONS_DLQ_QUEUE.send(message.body);
          message.ack();
          metrics.deadLettered += 1;
          continue;
        }
        message.retry();
        metrics.retried += 1;
      }
    }
    logServerMetric("queue.batch", {
      component: "cloudflare-worker",
      environment: env.APP_ENV ?? "unknown",
      queue: batch.queue,
      batchSize: batch.messages.length,
      ...metrics,
      outcome:
        metrics.retried > 0 ? "partial" : metrics.deadLettered > 0 ? "dead_lettered" : "success",
    });
  },
};

export default worker;
