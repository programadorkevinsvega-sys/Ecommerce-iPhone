import type { D1Database, Queue } from "@cloudflare/workers-types";
import { AnalyticsService } from "../application/AnalyticsService";
import { RevenueAnalyticsService } from "../application/RevenueAnalytics";
import { D1AnalyticsRepository } from "./D1AnalyticsRepository";
import { CloudflareAnalyticsQueuePublisher } from "./CloudflareAnalyticsQueuePublisher";
import { D1RevenueAnalyticsRepository } from "./D1RevenueAnalyticsRepository";
import { WebVitalsService } from "../application/WebVitalsService";
import { D1WebVitalsRepository } from "./D1WebVitalsRepository";

export function analyticsApplication(queue: Queue): AnalyticsService {
  return new AnalyticsService(new CloudflareAnalyticsQueuePublisher(queue));
}

export function analyticsPersistence(db: D1Database): D1AnalyticsRepository {
  return new D1AnalyticsRepository(db);
}

export function revenueAnalyticsApplication(db: D1Database, queue: Queue): RevenueAnalyticsService {
  return new RevenueAnalyticsService(
    new D1RevenueAnalyticsRepository(db),
    analyticsApplication(queue),
  );
}

export function revenueAnalyticsPersistence(db: D1Database): D1RevenueAnalyticsRepository {
  return new D1RevenueAnalyticsRepository(db);
}

export function webVitalsApplication(db: D1Database): WebVitalsService {
  return new WebVitalsService(new D1WebVitalsRepository(db));
}
