import { describe, expect, it } from "vitest";
import { AnalyticsService } from "./AnalyticsService";
import type { AnalyticsEvent } from "../domain/AnalyticsEvent";
import { SERVER_OWNED_ANALYTICS_EVENT_TYPES } from "../domain/AnalyticsEvent";
import { isClientAnalyticsEventType } from "./AnalyticsClientContract";
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

  it("exposes only non-privileged events through the browser contract", () => {
    expect(isClientAnalyticsEventType("ProductViewed")).toBe(true);
    expect(isClientAnalyticsEventType("ShippingMethodSelected")).toBe(true);

    for (const eventType of SERVER_OWNED_ANALYTICS_EVENT_TYPES) {
      expect(isClientAnalyticsEventType(eventType)).toBe(false);
    }
  });

  it.each(SERVER_OWNED_ANALYTICS_EVENT_TYPES)(
    "rejects client-originated %s events",
    async (eventType) => {
      const service = new AnalyticsService(new RecordingPort());

      await expect(
        service.record({
          eventId: "event-server-owned-123",
          eventType,
          occurredAt: "2026-09-29T12:00:00.000Z",
          sessionId: "session-12345678",
          visitorId: "visitor-12345678",
          source: "web",
          payload: {},
        }),
      ).rejects.toThrow("SERVER_OWNED_ANALYTICS_EVENT");
    },
  );

  it("accepts server-side purchase events with server-derived source", async () => {
    const port = new RecordingPort();
    const service = new AnalyticsService(port);

    await service.record({
      eventId: "purchase-12345678",
      eventType: "PurchaseCompleted",
      occurredAt: "2026-09-29T12:00:00.000Z",
      sessionId: "order-12345678",
      visitorId: "customer-12345678",
      source: "server",
      payload: {
        orderId: "order-12345678",
        paymentId: "payment-12345678",
        provider: "STRIPE",
        transactionId: "transaction-12345678",
        amountInCents: 10000,
        currency: "COP",
      },
    });

    expect(port.events[0]?.source).toBe("server");
    expect(port.events[0]?.eventType).toBe("PurchaseCompleted");
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
