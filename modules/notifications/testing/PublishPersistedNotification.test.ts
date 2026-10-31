import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotificationTestDatabase } from "./createNotificationTestDatabase";
import type { NotificationQueuePort } from "../application/NotificationQueuePort";
import type { NotificationEvent } from "../domain/NotificationEvent";
import { D1NotificationOutboxRepository } from "../infrastructure/D1NotificationOutboxRepository";
import { PublishPersistedNotification } from "../application/PublishPersistedNotification";

let database: ReturnType<typeof createNotificationTestDatabase>;

afterEach(() => database.close());

const event: NotificationEvent = {
  id: "order-created:order-queue-1",
  eventType: "OrderCreated",
  eventVersion: 1,
  aggregateId: "order-queue-1",
  createdAt: new Date().toISOString(),
  payload: {
    email: "buyer@example.com",
    orderId: "order-queue-1",
    orderNumber: "EIP-2026-QUEUE1",
    status: "PENDING_PAYMENT",
    totalInCents: 250000,
    currency: "COP",
  },
};

describe("PublishPersistedNotification", () => {
  it("retains a failed queue publication in D1 and retries without a second outbox insert", async () => {
    database = createNotificationTestDatabase();
    const outbox = new D1NotificationOutboxRepository(database.asD1());
    await outbox.enqueue(event);

    let fail = true;
    const queue: NotificationQueuePort = {
      publish: vi.fn(async () => {
        if (fail) throw new Error("Bearer private-token api_key=hidden");
      }),
    };
    const logger = { warn: vi.fn(), error: vi.fn() };
    const publisher = new PublishPersistedNotification(outbox, queue, logger);

    expect(await publisher.execute(event.id)).toBe("retry-scheduled");
    const failed = await outbox.findById(event.id);
    expect(failed?.status).toBe("FAILED");
    expect(failed?.attempts).toBe(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).not.toContain("private-token");
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM notification_outbox")[0]
        .count,
    ).toBe(1);

    database.exec(
      "UPDATE notification_outbox SET available_at=datetime('now','-1 second') WHERE id=?",
      event.id,
    );
    fail = false;
    expect(await publisher.execute(event.id)).toBe("published");
    expect(await publisher.execute(event.id)).toBe("deferred");
    expect(queue.publish).toHaveBeenCalledTimes(2);
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM notification_outbox")[0]
        .count,
    ).toBe(1);
    expect(await outbox.claim(event.id, 900)).toBe(true);
  });
});
