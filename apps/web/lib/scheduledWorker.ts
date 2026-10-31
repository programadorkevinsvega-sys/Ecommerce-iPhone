import type { ScheduledEvent } from "@cloudflare/workers-types";
import { D1NotificationOutboxRepository } from "../../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import { D1ReservationRepository } from "../../../modules/orders/infrastructure/D1ReservationRepository";
import { analyticsPersistence } from "../../../modules/analytics/infrastructure/analyticsComposition";
import { mediaKeyFromUrl } from "../../../modules/shared-kernel/MediaReference";
import {
  MEDIA_CLEANUP_PREFIXES,
  MEDIA_CLEANUP_SCAN_PAGE_SIZE,
  processOrphanMediaPage,
} from "./mediaCleanupScheduler";
import { runScheduledTasks, sanitizeScheduledErrorMessage } from "./scheduledTaskRunner";
import { notificationQueuePublisher } from "./notificationsApplication";
import { revenueAnalyticsApp } from "./analyticsApplication";

type MediaCleanupResult = "deleted" | "referenced" | "requeued" | "invalid";

async function processMediaCleanupQueue(env: CloudflareEnv): Promise<void> {
  const rows = await env.DB.prepare(
    "SELECT object_key,attempts FROM media_cleanup_queue WHERE available_at<=CURRENT_TIMESTAMP ORDER BY created_at ASC LIMIT 100",
  ).all<{ object_key: string; attempts: number }>();

  let failures = 0;
  for (const row of rows.results) {
    try {
      await cleanupMediaKey(env, row.object_key, row.attempts);
    } catch {
      failures += 1;
    }
  }

  if (failures > 0) {
    throw new Error(`MEDIA_CLEANUP_QUEUE_ITEM_FAILURES:${failures}`);
  }
}

async function processOrphanMediaPrefix(
  env: CloudflareEnv,
  prefix: (typeof MEDIA_CLEANUP_PREFIXES)[number],
): Promise<void> {
  const scanStore = {
    async loadDue(currentPrefix: string): Promise<{ cursor: string | null } | null> {
      const row = await env.DB.prepare(
        "SELECT cursor FROM media_cleanup_scan_state WHERE prefix=? AND next_scan_at<=CURRENT_TIMESTAMP LIMIT 1",
      )
        .bind(currentPrefix)
        .first<{ cursor: string | null }>();
      return row ? { cursor: row.cursor } : null;
    },
    async save(
      currentPrefix: string,
      expectedCursor: string | null,
      cursor: string | null,
      completed: boolean,
    ): Promise<void> {
      const result = await env.DB.prepare(
        "UPDATE media_cleanup_scan_state SET cursor=?,next_scan_at=CASE WHEN ?=1 THEN datetime('now','+6 hours') ELSE CURRENT_TIMESTAMP END,updated_at=CURRENT_TIMESTAMP WHERE prefix=? AND cursor IS ?",
      )
        .bind(cursor, completed ? 1 : 0, currentPrefix, expectedCursor)
        .run();
      if (result.meta.changes !== 1) {
        throw new Error("MEDIA_CLEANUP_SCAN_STATE_CHANGED");
      }
    },
  };

  await processOrphanMediaPage({
    bucket: env.MEDIA_BUCKET,
    scanStore,
    prefixes: [prefix],
    cutoffTimestamp: Date.now() - 24 * 60 * 60 * 1000,
    pageSize: MEDIA_CLEANUP_SCAN_PAGE_SIZE,
    cleanup: async (key) => cleanupMediaKey(env, key, 0),
  });
}

async function cleanupMediaKey(
  env: CloudflareEnv,
  key: string,
  attempts: number,
): Promise<MediaCleanupResult> {
  if (!mediaKeyFromUrl("/api/media/" + key)) {
    await env.DB.prepare("DELETE FROM media_cleanup_queue WHERE object_key=?").bind(key).run();
    return "invalid";
  }

  const url = "/api/media/" + key;
  const referenced = await env.DB.prepare(
    "SELECT CASE WHEN EXISTS (SELECT 1 FROM product_images WHERE url=?) OR EXISTS (SELECT 1 FROM categories WHERE image_url=?) OR EXISTS (SELECT 1 FROM service_types WHERE image_url=?) OR EXISTS (SELECT 1 FROM cms_blog_posts WHERE cover_image_url=?) OR EXISTS (SELECT 1 FROM marketing_banners WHERE image_url=?) OR EXISTS (SELECT 1 FROM seo_route_overrides WHERE og_image_url=?) OR EXISTS (SELECT 1 FROM cms_pages WHERE content LIKE ?) OR EXISTS (SELECT 1 FROM cms_landing_pages WHERE content LIKE ?) THEN 1 ELSE 0 END AS referenced",
  )
    .bind(url, url, url, url, url, url, "%" + url + "%", "%" + url + "%")
    .first<{ referenced: number }>();

  if (Number(referenced?.referenced ?? 0) === 1) {
    await env.DB.prepare("DELETE FROM media_cleanup_queue WHERE object_key=?").bind(key).run();
    return "referenced";
  }

  try {
    await env.MEDIA_BUCKET.delete(key);
    await env.DB.prepare("DELETE FROM media_cleanup_queue WHERE object_key=?").bind(key).run();
    return "deleted";
  } catch (error) {
    const nextAttempts = attempts + 1;
    const delay = Math.min(3600, 2 ** Math.min(nextAttempts, 10));
    await env.DB.prepare(
      "INSERT INTO media_cleanup_queue(object_key,attempts,available_at,last_error,updated_at) VALUES(?,?,datetime('now','+'||?||' seconds'),?,CURRENT_TIMESTAMP) ON CONFLICT(object_key) DO UPDATE SET attempts=excluded.attempts,available_at=excluded.available_at,last_error=excluded.last_error,updated_at=CURRENT_TIMESTAMP",
    )
      .bind(key, nextAttempts, delay, sanitizeScheduledErrorMessage(error))
      .run();
    return "requeued";
  }
}

async function recordAbandonedCarts(env: CloudflareEnv): Promise<void> {
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

export async function runScheduledWorker(
  _event: ScheduledEvent,
  env: CloudflareEnv,
): Promise<void> {
  const now = new Date().toISOString();
  const tasks = [
    {
      name: "media-cleanup-queue",
      run: () => processMediaCleanupQueue(env),
    },
    ...MEDIA_CLEANUP_PREFIXES.map((prefix) => ({
      name: `media-orphan-scan:${prefix}`,
      run: () => processOrphanMediaPrefix(env, prefix),
    })),
    {
      name: "analytics-expiration",
      run: async () => {
        await analyticsPersistence(env.DB).purgeExpired(500);
      },
    },
    {
      name: "revenue-analytics-reconciliation",
      run: async () => {
        await revenueAnalyticsApp(env).reconcile(500);
      },
    },
    {
      name: "abandoned-cart-analytics",
      run: () => recordAbandonedCarts(env),
    },
    {
      name: "scheduled-cms-publishing",
      run: async () => {
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE cms_blog_posts SET status='PUBLISHED',published_at=scheduled_at,updated_at=CURRENT_TIMESTAMP WHERE status='SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at<=?",
          ).bind(now),
          env.DB.prepare(
            "UPDATE cms_landing_pages SET status='PUBLISHED',published_at=scheduled_at,updated_at=CURRENT_TIMESTAMP WHERE status='SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at<=?",
          ).bind(now),
        ]);
      },
    },
    {
      name: "inventory-reservation-release",
      run: async () => {
        await new D1ReservationRepository(env.DB).releaseExpired();
      },
    },
    {
      name: "notification-outbox-publish",
      run: async () => {
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
              sanitizeScheduledErrorMessage(error),
              new Date(Date.now() + 60_000).toISOString().replace("T", " ").replace("Z", ""),
            );
          }
        }
      },
    },
  ];

  await runScheduledTasks(tasks);
}
