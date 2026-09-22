import { describe, expect, it } from "vitest";
import { NotificationService } from "./NotificationService";
import type { NotificationInboxItem, NotificationEvent, NotificationRecipient } from "../domain/NotificationEvent";
import type { EmailProvider, NotificationOutboxRepository, OutboxRecord } from "./NotificationPorts";
import type { NotificationInboxRepository } from "./NotificationInboxRepository";
import type { NotificationRealtimePort } from "./NotificationRealtimePort";

class MemoryOutbox implements NotificationOutboxRepository {
  records = new Map<string, NotificationEvent>();
  deliveries = new Set<string>();
  async enqueue(e: NotificationEvent) { this.records.set(e.id, e); return true; }
  async findById(id: string) { const event = this.records.get(id); return event ? { ...event, status: "QUEUED" as const, attempts: 0, availableAt: event.createdAt } satisfies OutboxRecord : null; }
  async pending(_limit: number): Promise<OutboxRecord[]> { return []; }
  async claim(_id: string, _leaseSeconds: number) { return true; }
  async markQueued(_id: string) {}
  async markProcessed(id: string) { this.records.delete(id); }
  async markFailed(_id: string, _error: string, _retryAt: string) {}
  async claimDelivery(_input: Parameters<NotificationOutboxRepository["claimDelivery"]>[0]) { return true; }
  async hasDelivery(_id: string, _channel: "EMAIL", recipient: string, template: string) { return this.deliveries.has(`${recipient}:${template}`); }
  async recordDelivery(input: Parameters<NotificationOutboxRepository["recordDelivery"]>[0]) { if (input.status === "SENT") this.deliveries.add(`${input.recipient}:${input.template}`); }
}

class MemoryInbox implements NotificationInboxRepository {
  items: NotificationInboxItem[] = [];
  async create(item: NotificationInboxItem) { this.items.push(item); return true; }
  async list(_recipient: NotificationRecipient, _limit: number) { return { items: [], nextCursor: null }; }
  async unreadCount(_recipient: NotificationRecipient) { return 0; }
  async markRead(_recipient: NotificationRecipient, _notificationId: string) { return true; }
  async markAllRead(_recipient: NotificationRecipient) { return 0; }
}

class MemoryRealtime implements NotificationRealtimePort {
  published: NotificationInboxItem[] = [];
  async publish(item: NotificationInboxItem) { this.published.push(item); }
}

class MemoryEmail implements EmailProvider {
  sent: unknown[] = [];
  async send(input: Parameters<EmailProvider["send"]>[0]) { this.sent.push(input); return { id: "resend-1" }; }
}

function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: "evt-1",
    eventType: "OrderCreated",
    eventVersion: 1,
    aggregateId: "ord-1",
    createdAt: new Date().toISOString(),
    payload: { email: "buyer@example.com", orderNumber: "VEGA-1001", status: "PENDING_PAYMENT" },
    ...overrides,
  };
}

describe("NotificationService", () => {
  it("sends an order-created email with a deterministic idempotency key", async () => {
    const outbox = new MemoryOutbox();
    const email = new MemoryEmail();
    const service = new NotificationService(outbox, email, new MemoryInbox(), new MemoryRealtime());
    await service.process(event());
    expect(email.sent).toHaveLength(1);
    expect((email.sent[0] as { idempotencyKey: string }).idempotencyKey).toBe("ecommerce-iphone/email/OrderCreated/ord-1/evt-1");
    expect(outbox.records.has("evt-1")).toBe(false);
    expect(outbox.deliveries.size).toBe(1);
  });

  it("projects an explicit recipient exactly once", async () => {
    const inbox = new MemoryInbox();
    const realtime = new MemoryRealtime();
    const service = new NotificationService(new MemoryOutbox(), new MemoryEmail(), inbox, realtime);
    await service.process(event({
      recipients: [{ type: "customer", id: "customer-1", email: "buyer@example.com" }],
      payload: { message: "Tu pedido cambió de estado" },
    }));
    expect(inbox.items).toHaveLength(1);
    expect(realtime.published).toHaveLength(1);
    expect(inbox.items[0].recipientId).toBe("customer-1");
  });

  it("is idempotent when the email delivery already exists", async () => {
    const outbox = new MemoryOutbox();
    const email = new MemoryEmail();
    outbox.deliveries.add("buyer@example.com:ORDER_PAID");
    const service = new NotificationService(outbox, email, new MemoryInbox(), new MemoryRealtime());
    await service.process(event({
      id: "evt-2",
      eventType: "OrderPaid",
      aggregateId: "ord-2",
      payload: { email: "buyer@example.com", orderNumber: "VEGA-1002" },
    }));
    expect(email.sent).toHaveLength(0);
  });
});
