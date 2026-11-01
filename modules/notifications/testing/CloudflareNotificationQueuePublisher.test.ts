import { describe, expect, it, vi } from "vitest";
import type { Queue } from "@cloudflare/workers-types";
import type { NotificationEvent } from "../domain/NotificationEvent";
import { CloudflareNotificationQueuePublisher } from "../infrastructure/CloudflareNotificationQueuePublisher";

describe("CloudflareNotificationQueuePublisher", () => {
  it("preserves the HTTP request ID on the queued outbox message", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const publisher = new CloudflareNotificationQueuePublisher({ send } as unknown as Queue);
    const event: NotificationEvent = {
      id: "order-created:order-1",
      eventType: "OrderCreated",
      eventVersion: 1,
      aggregateId: "order-1",
      createdAt: "2026-10-31T12:00:00.000Z",
      requestId: "req_checkout_12345678",
      payload: { orderId: "order-1" },
    };

    await publisher.publish(event);

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(send.mock.calls[0]?.[0]))).toEqual({
      schemaVersion: 1,
      outboxId: "order-created:order-1",
      requestId: "req_checkout_12345678",
    });
  });

  it("keeps legacy queue message shape when no request ID was recorded", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const publisher = new CloudflareNotificationQueuePublisher({ send } as unknown as Queue);
    const event: NotificationEvent = {
      id: "order-created:order-2",
      eventType: "OrderCreated",
      eventVersion: 1,
      aggregateId: "order-2",
      createdAt: "2026-10-31T12:00:00.000Z",
      payload: { orderId: "order-2" },
    };

    await publisher.publish(event);

    expect(JSON.parse(String(send.mock.calls[0]?.[0]))).toEqual({
      schemaVersion: 1,
      outboxId: "order-created:order-2",
    });
  });
});
