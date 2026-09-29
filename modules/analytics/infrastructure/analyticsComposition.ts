import type { D1Database, Queue } from "@cloudflare/workers-types";
import { AnalyticsService } from "../application/AnalyticsService";
import { D1AnalyticsRepository } from "./D1AnalyticsRepository";
import { CloudflareAnalyticsQueuePublisher } from "./CloudflareAnalyticsQueuePublisher";
export function analyticsApplication(queue: Queue): AnalyticsService {
  return new AnalyticsService(new CloudflareAnalyticsQueuePublisher(queue));
}
export function analyticsPersistence(db: D1Database): D1AnalyticsRepository {
  return new D1AnalyticsRepository(db);
}
