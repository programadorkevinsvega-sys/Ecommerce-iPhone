import {
  analyticsApplication as buildAnalyticsApplication,
  revenueAnalyticsApplication as buildRevenueAnalyticsApplication,
  revenueAnalyticsPersistence as buildRevenueAnalyticsPersistence,
} from "@modules/analytics/infrastructure/analyticsComposition";

export function analyticsApp(env: CloudflareEnv) {
  return buildAnalyticsApplication(env.EVENTS_QUEUE);
}

export function revenueAnalyticsApp(env: CloudflareEnv) {
  return buildRevenueAnalyticsApplication(env.DB, env.EVENTS_QUEUE);
}

export function revenueAnalyticsPersistence(env: CloudflareEnv) {
  return buildRevenueAnalyticsPersistence(env.DB);
}
