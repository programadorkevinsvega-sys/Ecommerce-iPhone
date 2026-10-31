import { afterEach, describe, expect, it } from "vitest";
import { createNotificationTestDatabase } from "./createNotificationTestDatabase";
import type { NotificationEvent } from "../domain/NotificationEvent";
import { D1NotificationOutboxRepository } from "../infrastructure/D1NotificationOutboxRepository";

let database: ReturnType<typeof createNotificationTestDatabase>;

afterEach(() => database.close());

const event: NotificationEvent = {
  id: "order-created:order-1",
  eventType: "OrderCreated",
  eventVersion: 1,
  aggregateId: "order-1",
  createdAt: new Date().toISOString(),
  payload: {
    email: "buyer@example.com",
    orderId: "order-1",
    orderNumber: "EIP-2026-ORDER1",
    status: "PENDING_PAYMENT",
    totalInCents: 100000,
    currency: "COP",
  },
};

describe("D1NotificationOutboxRepository", () => {
  it("deduplicates the stable event identity", async () => {
    database = createNotificationTestDatabase();
    const repository = new D1NotificationOutboxRepository(database.asD1());

    expect(await repository.enqueue(event)).toBe(true);
    expect(await repository.enqueue(event)).toBe(false);
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM notification_outbox")[0]
        .count,
    ).toBe(1);
    expect((await repository.findById(event.id))?.aggregateId).toBe("order-1");
  });

  it("keeps queue failures durable and sanitized, then allows recovery", async () => {
    database = createNotificationTestDatabase();
    const repository = new D1NotificationOutboxRepository(database.asD1());
    await repository.enqueue(event);

    expect(await repository.claim(event.id, 60)).toBe(true);
    const retryAt = new Date(Date.now() - 1000).toISOString().replace("T", " ").replace("Z", "");
    await repository.markFailed(event.id, "Bearer super-secret api_key=private-value", retryAt);

    const failed = database.query<{ status: string; attempts: number; last_error: string }>(
      "SELECT status,attempts,last_error FROM notification_outbox WHERE id=?",
      event.id,
    )[0];
    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(1);
    expect(failed.last_error).not.toContain("super-secret");
    expect(failed.last_error).not.toContain("private-value");
    expect((await repository.pending(10)).map((record) => record.id)).toContain(event.id);

    expect(await repository.claim(event.id, 60)).toBe(true);
    await repository.markQueued(event.id);
    expect(await repository.claim(event.id, 900)).toBe(true);
    expect((await repository.pending(10)).map((record) => record.id)).not.toContain(event.id);

    database.exec(
      "UPDATE notification_outbox SET queue_published_at=datetime('now','-901 seconds'),lease_expires_at=datetime('now','-1 second') WHERE id=?",
      event.id,
    );
    expect((await repository.pending(10)).map((record) => record.id)).toContain(event.id);
  });
});
