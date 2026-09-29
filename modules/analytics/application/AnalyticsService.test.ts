import { describe, expect, it } from "vitest";
import { AnalyticsService } from "./AnalyticsService";
import type { AnalyticsEvent } from "../domain/AnalyticsEvent";
import type { AnalyticsPort } from "./AnalyticsPort";

class RecordingPort implements AnalyticsPort {
  events: AnalyticsEvent[] = [];

  async record(event: AnalyticsEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("AnalyticsService", () => {
  it("accepts catalog and search interaction events", async () => {
    const port = new RecordingPort();
    const service = new AnalyticsService(port);

    await service.record({
      eventId: "event-12345678",
      eventType: "ProductViewed",
      occurredAt: "2026-09-29T12:00:00.000Z",
      sessionId: "session-12345678",
      visitorId: "visitor-12345678",
      payload: { productId: "product-12345678", brand: "Apple" },
    });

    await service.record({
      eventId: "event-22345678",
      eventType: "SearchResultClicked",
      occurredAt: "2026-09-29T12:00:01.000Z",
      sessionId: "session-12345678",
      visitorId: "visitor-12345678",
      payload: { productId: "product-12345678", position: 1 },
    });

    expect(port.events).toHaveLength(2);
    expect(port.events.map((event) => event.eventType)).toEqual([
      "ProductViewed",
      "SearchResultClicked",
    ]);
  });

  it("rejects sensitive catalog analytics payloads", async () => {
    const port = new RecordingPort();
    const service = new AnalyticsService(port);

    await expect(
      service.record({
        eventId: "event-32345678",
        eventType: "SearchPerformed",
        occurredAt: "2026-09-29T12:00:00.000Z",
        sessionId: "session-12345678",
        visitorId: "visitor-12345678",
        payload: { email: "customer@example.com" },
      }),
    ).rejects.toThrow("ANALYTICS_SENSITIVE_FIELD");
  });
});
