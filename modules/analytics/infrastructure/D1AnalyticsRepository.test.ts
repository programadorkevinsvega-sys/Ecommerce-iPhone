import { describe, expect, it } from "vitest";
import { D1AnalyticsRepository } from "./D1AnalyticsRepository";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";
import type { AnalyticsEvent } from "../domain/AnalyticsEvent";

const event: AnalyticsEvent = {
  eventId: "evt_01JTESTANALYTICS01",
  eventType: "ProductViewed",
  eventVersion: 1,
  occurredAt: "2026-09-29T00:00:00.000Z",
  receivedAt: "2026-09-29T00:00:01.000Z",
  sessionId: "ses_01JTESTANALYTICS01",
  visitorId: "vis_01JTESTANALYTICS01",
  source: "web",
  payload: { productId: "prod_123", slug: "iphone-16" },
};

describe("D1AnalyticsRepository", () => {
  it("deduplicates repeated event identifiers", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      const repository = new D1AnalyticsRepository(database.asD1());
      await repository.record(event);
      await repository.record(event);
      const rows = database.query<{ count: number }>("SELECT COUNT(*) AS count FROM analytics_events");
      expect(rows[0]?.count).toBe(1);
    } finally {
      database.close();
    }
  });
});
