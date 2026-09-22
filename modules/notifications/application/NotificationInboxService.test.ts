import { describe, expect, it } from "vitest";
import { NotificationInboxService } from "./NotificationInboxService";
import type { NotificationInboxRepository } from "./NotificationInboxRepository";
import type { NotificationInboxItem, NotificationRecipient } from "../domain/NotificationEvent";

class MemoryInbox implements NotificationInboxRepository {
  items: NotificationInboxItem[] = [];
  async create(item: NotificationInboxItem) { if (this.items.some((value) => value.eventId === item.eventId && value.recipientId === item.recipientId && value.recipientType === item.recipientType)) return false; this.items.push(item); return true; }
  async findByEventRecipient(eventId: string, recipient: NotificationRecipient) { return this.items.find((value) => value.eventId === eventId && value.recipientType === recipient.type && value.recipientId === recipient.id) ?? null; }
  async list(recipient: NotificationRecipient, limit: number) { return { items: this.items.filter((value) => value.recipientType === recipient.type && value.recipientId === recipient.id).slice(0, limit), nextCursor: null }; }
  async unreadCount(recipient: NotificationRecipient) { return this.items.filter((value) => value.recipientType === recipient.type && value.recipientId === recipient.id && !value.readAt).length; }
  async markRead(recipient: NotificationRecipient, notificationId: string) { const item = this.items.find((value) => value.id === notificationId && value.recipientType === recipient.type && value.recipientId === recipient.id); if (!item) return false; item.readAt = new Date().toISOString(); return true; }
  async markAllRead(recipient: NotificationRecipient) { let count = 0; for (const item of this.items) if (item.recipientType === recipient.type && item.recipientId === recipient.id && !item.readAt) { item.readAt = new Date().toISOString(); count += 1; } return count; }
}

describe("NotificationInboxService", () => {
  it("cannot read or count another recipient's notifications", async () => {
    const repository = new MemoryInbox();
    const service = new NotificationInboxService(repository);
    const mine = { type: "customer", id: "customer-1" } as const;
    const other = { type: "customer", id: "customer-2" } as const;

    await repository.create({
      id: "notification-1",
      eventId: "event-1",
      eventType: "OrderPaid",
      eventVersion: 1,
      recipientType: "customer",
      recipientId: "customer-1",
      title: "Pago confirmado",
      body: "Tu pago fue confirmado.",
      payload: {},
      createdAt: new Date().toISOString(),
    });

    expect(await service.unreadCount(other)).toBe(0);
    expect(await service.markRead(other, "notification-1")).toBe(false);
    expect((await service.list(other, 10)).items).toHaveLength(0);
    expect((await service.list(mine, 10)).items).toHaveLength(1);
  });
});
