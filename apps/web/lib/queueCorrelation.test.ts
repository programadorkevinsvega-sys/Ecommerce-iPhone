import { describe, expect, it } from "vitest";
import { resolveQueueCorrelation } from "./queueCorrelation";

describe("Queue correlation", () => {
  it("prefers the originating API request ID for analytics events", () => {
    expect(
      resolveQueueCorrelation({
        requestId: "req_checkout_12345",
        eventId: "analytics-event-123",
      }),
    ).toBe("req_checkout_12345");
  });

  it("falls back to the analytics event ID when no valid request ID exists", () => {
    expect(
      resolveQueueCorrelation({
        requestId: "not valid",
        eventId: "cart-abandoned:cart-123:2026-10-31",
      }),
    ).toBe("cart-abandoned:cart-123:2026-10-31");
  });

  it("uses the durable notification outbox ID", () => {
    expect(resolveQueueCorrelation({ outboxId: "outbox-123" })).toBe("outbox-123");
  });

  it("uses the queue message ID as a last resort and rejects unsafe IDs", () => {
    expect(resolveQueueCorrelation({}, "queue-msg-123")).toBe("queue-msg-123");
    expect(resolveQueueCorrelation({ eventId: "bad\nvalue" }, "bad\nvalue")).toBeUndefined();
  });
});
