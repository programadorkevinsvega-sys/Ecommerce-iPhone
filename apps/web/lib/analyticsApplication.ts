import { analyticsApplication as buildAnalyticsApplication } from "@modules/analytics/infrastructure/analyticsComposition";

export function analyticsApp(env: CloudflareEnv) {
  return buildAnalyticsApplication(env.EVENTS_QUEUE);
}
