import { describe, expect, it } from "vitest";
import { NotificationService } from "./NotificationService";
import type {
  NotificationInboxItem,
  NotificationEvent,
  NotificationRecipient,
} from "../domain/NotificationEvent";
import type {
  EmailProvider,
  NotificationOutboxRepository,
  OutboxRecord,
} from "./NotificationPorts";
import type { NotificationInboxRepository } from "./NotificationInboxRepository";
import type { NotificationRealtimePort } from "./NotificationRealtimePort";
import type { NotificationDeliveryRepository } from "./NotificationDeliveryRepository";
import type { NotificationPreferenceRepository } from "./NotificationPreferenceRepository";
import {
  NotificationProviderError,
  NotificationTerminalError,
} from "./NotificationProcessingError";

class MemoryOutbox implements NotificationOutboxRepository {
  records = new Map<string, NotificationEvent>();
  deliveries = new Set<string>();
  terminal = new Set<string>();
  processed = new Set<string>();
  failed = new Set<string>();
  attempts = new Map<string, number>();
  async enqueue(e: NotificationEvent) {
    this.records.set(e.id, e);
    return true;
  }
  async findById(id: string) {
    const event = this.records.get(id);
    if (!event) return null;
    const status = this.processed.has(id)
      ? "PROCESSED"
      : this.failed.has(id)
        ? "FAILED"
        : "PENDING";
    return {
      ...event,
      status: status as OutboxRecord["status"],
      attempts: this.attempts.get(id) ?? 0,
      availableAt: event.createdAt,
    } satisfies OutboxRecord;
  }
  async pending(_limit: number): Promise<OutboxRecord[]> {
    return [];
  }
  busy = new Set<string>();
  async claim(id: string, _leaseSeconds: number) {
    return !this.busy.has(id) && !this.processed.has(id) && !this.terminal.has(id);
  }
  async markQueued(_id: string) {}
  async markProcessed(id: string) {
    this.processed.add(id);
    this.failed.delete(id);
  }
  async markFailed(id: string, _error: string, _retryAt: string) {
    this.failed.add(id);
    this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
  }
  async markTerminal(id: string, _error: string) {
    this.terminal.add(id);
  }
  async claimDelivery(_input: Parameters<NotificationOutboxRepository["claimDelivery"]>[0]) {
    return true;
  }
  async hasDelivery(_id: string, _channel: "EMAIL", recipient: string, template: string) {
    return this.deliveries.has(`${recipient}:${template}`);
  }
  async recordDelivery(input: Parameters<NotificationOutboxRepository["recordDelivery"]>[0]) {
    if (input.status === "SENT") this.deliveries.add(`${input.recipient}:${input.template}`);
  }
}

class MemoryInbox implements NotificationInboxRepository {
  items: NotificationInboxItem[] = [];
  async create(item: NotificationInboxItem) {
    this.items.push(item);
    return true;
  }
  async findByEventRecipient(eventId: string, recipient: NotificationRecipient) {
    return (
      this.items.find(
        (item) =>
          item.eventId === eventId &&
          item.recipientType === recipient.type &&
          item.recipientId === recipient.id,
      ) ?? null
    );
  }
  async list(_recipient: NotificationRecipient, _limit: number) {
    return { items: [], nextCursor: null };
  }
  async unreadCount(_recipient: NotificationRecipient) {
    return 0;
  }
  async markRead(_recipient: NotificationRecipient, _notificationId: string) {
    return true;
  }
  async markAllRead(_recipient: NotificationRecipient) {
    return 0;
  }
}

class MemoryRealtime implements NotificationRealtimePort {
  published: NotificationInboxItem[] = [];
  async publish(item: NotificationInboxItem) {
    this.published.push(item);
  }
}

class MemoryEmail implements EmailProvider {
  sent: unknown[] = [];
  error: Error | null = null;
  async send(input: Parameters<EmailProvider["send"]>[0]) {
    this.sent.push(input);
    if (this.error) throw this.error;
    return { id: "resend-1" };
  }
}

class MemoryDelivery implements NotificationDeliveryRepository {
  sent = new Set<string>();
  async hasSentEmail(
    notificationId: string,
    recipient: NotificationRecipient,
    recipientEmail: string,
  ) {
    return this.sent.has(`${notificationId}:${recipient.type}:${recipient.id}:${recipientEmail}`);
  }
  async claimEmail() {
    return true;
  }
  async recordEmail(input: Parameters<NotificationDeliveryRepository["recordEmail"]>[0]) {
    if (input.status === "SENT") {
      this.sent.add(
        `${input.notificationId}:${input.recipient.type}:${input.recipient.id}:${input.recipientEmail}`,
      );
    }
  }
}

class MemoryPreferences implements NotificationPreferenceRepository {
  disabled = new Set<string>();
  async isEnabled(
    recipient: NotificationRecipient,
    channel: "EMAIL" | "IN_APP",
    eventType: string,
  ) {
    return !this.disabled.has(`${recipient.type}:${recipient.id}:${channel}:${eventType}`);
  }
}

function buildService(
  outbox = new MemoryOutbox(),
  email = new MemoryEmail(),
  inbox = new MemoryInbox(),
  realtime = new MemoryRealtime(),
  deliveries = new MemoryDelivery(),
  preferences = new MemoryPreferences(),
) {
  return {
    service: new NotificationService(outbox, email, inbox, realtime, deliveries, preferences),
    outbox,
    email,
    inbox,
    realtime,
  };
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
  it("sends an order-created email with deterministic idempotency", async () => {
    const { service, outbox, email } = buildService();
    await service.process(event());
    expect(email.sent).toHaveLength(1);
    expect((email.sent[0] as { idempotencyKey: string }).idempotencyKey).toBe(
      "ecommerce-iphone/email/OrderCreated/ord-1/evt-1",
    );
    expect(outbox.processed.has("evt-1")).toBe(true);
  });

  it("does not repeat side effects when the same queue event is delivered twice", async () => {
    const { service, outbox, email } = buildService();
    await outbox.enqueue(event());

    await service.processByOutboxId("evt-1");
    await service.processByOutboxId("evt-1");

    expect(email.sent).toHaveLength(1);
    expect(outbox.processed.has("evt-1")).toBe(true);
  });

  it("does not repeat work for a duplicate queue delivery while another consumer holds the lease", async () => {
    const { service, outbox, email } = buildService();
    await outbox.enqueue(event());
    outbox.busy.add("evt-1");

    await expect(service.processByOutboxId("evt-1")).resolves.toBeUndefined();
    expect(email.sent).toHaveLength(0);
    expect(outbox.records.has("evt-1")).toBe(true);

    outbox.busy.delete("evt-1");
    await service.processByOutboxId("evt-1");
    expect(email.sent).toHaveLength(1);
    expect(outbox.processed.has("evt-1")).toBe(true);
  });

  it("recovers a transient processing failure using the same durable event identity", async () => {
    const email = new MemoryEmail();
    email.error = new NotificationProviderError("temporary provider failure", {
      retryable: true,
      status: 503,
    });
    const { service, outbox } = buildService(undefined, email);
    await outbox.enqueue(event());

    await expect(service.processByOutboxId("evt-1")).rejects.toThrow("temporary provider failure");
    expect(outbox.failed.has("evt-1")).toBe(true);
    expect(outbox.attempts.get("evt-1")).toBe(1);

    email.error = null;
    await service.processByOutboxId("evt-1");
    expect(email.sent).toHaveLength(2);
    expect(outbox.processed.has("evt-1")).toBe(true);
    expect(outbox.records.size).toBe(1);
  });

  it("projects an explicit recipient exactly once", async () => {
    const { service, inbox, realtime } = buildService();
    await service.process(
      event({
        recipients: [{ type: "customer", id: "customer-1", email: "buyer@example.com" }],
        payload: { message: "Tu pedido cambió de estado" },
      }),
    );
    expect(inbox.items).toHaveLength(1);
    expect(realtime.published).toHaveLength(1);
    expect(inbox.items[0].recipientId).toBe("customer-1");
  });

  it("uses the channel ledger for an explicit recipient", async () => {
    const delivery = new MemoryDelivery();
    const { service, inbox } = buildService(
      undefined,
      undefined,
      undefined,
      undefined,
      delivery,
      undefined,
    );
    await service.process(
      event({
        recipients: [{ type: "customer", id: "customer-1", email: "buyer@example.com" }],
      }),
    );
    expect(inbox.items).toHaveLength(1);
    expect(delivery.sent.size).toBe(1);
  });

  it("respects an explicit email preference without removing the inbox event", async () => {
    const preferences = new MemoryPreferences();
    preferences.disabled.add("customer:customer-1:EMAIL:OrderCreated");
    const { service, inbox, email } = buildService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      preferences,
    );
    await service.process(
      event({
        recipients: [{ type: "customer", id: "customer-1", email: "buyer@example.com" }],
      }),
    );
    expect(inbox.items).toHaveLength(1);
    expect(email.sent).toHaveLength(0);
  });

  it("sends terminal provider failures to the terminal path", async () => {
    const email = new MemoryEmail();
    email.error = new NotificationProviderError("invalid sender", {
      retryable: false,
      status: 400,
    });
    const { service, outbox } = buildService(undefined, email);
    await expect(service.process(event())).rejects.toBeInstanceOf(NotificationTerminalError);
    expect(outbox.terminal.has("evt-1")).toBe(true);
  });

  it("retries transient provider failures", async () => {
    const email = new MemoryEmail();
    email.error = new NotificationProviderError("rate limited", { retryable: true, status: 429 });
    const { service, outbox } = buildService(undefined, email);
    await expect(service.process(event())).rejects.toBeInstanceOf(NotificationProviderError);
    expect(outbox.terminal.has("evt-1")).toBe(false);
  });

  it("is idempotent when the legacy email delivery already exists", async () => {
    const outbox = new MemoryOutbox();
    outbox.deliveries.add("buyer@example.com:ORDER_PAID");
    const { service, email } = buildService(outbox);
    await service.process(
      event({
        id: "evt-2",
        eventType: "OrderPaid",
        aggregateId: "ord-2",
        payload: { email: "buyer@example.com", orderNumber: "VEGA-1002" },
      }),
    );
    expect(email.sent).toHaveLength(0);
  });
});
