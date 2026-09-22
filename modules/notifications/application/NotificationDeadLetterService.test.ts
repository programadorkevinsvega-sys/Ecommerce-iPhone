import { describe, expect, it } from "vitest";
import { NotificationDeadLetterService } from "./NotificationDeadLetterService";
import type { NotificationAuditPort } from "./NotificationAuditPort";
import type { NotificationDeadLetter, NotificationDeadLetterRepository } from "./NotificationDeadLetterRepository";
import type { NotificationRawQueuePort } from "./NotificationRawQueuePort";

class MemoryDlq implements NotificationDeadLetterRepository {
  item: NotificationDeadLetter = {
    id: "dlq-1",
    queueName: "ecommerce-iphone-notifications",
    messageBody: JSON.stringify({ schemaVersion: 1, outboxId: "event-1" }),
    status: "OPEN",
    attempts: 5,
    firstSeenAt: new Date().toISOString(),
  };
  async record() {}
  async list() { return [this.item]; }
  async find(id: string) { return id === this.item.id ? this.item : null; }
  async markReplayed(id: string, adminId: string) { if (id !== this.item.id || this.item.status !== "OPEN") return false; this.item = { ...this.item, status: "REPLAYED", replayedBy: adminId, lastReplayedAt: new Date().toISOString() }; return true; }
}

class MemoryQueue implements NotificationRawQueuePort {
  messages: string[] = [];
  async publishRaw(message: string) { this.messages.push(message); }
}

class MemoryAudit implements NotificationAuditPort {
  records: unknown[] = [];
  async record(input: Parameters<NotificationAuditPort["record"]>[0]) { this.records.push(input); }
}

describe("NotificationDeadLetterService", () => {
  it("replays using the original message and records an audit event", async () => {
    const repository = new MemoryDlq();
    const queue = new MemoryQueue();
    const audit = new MemoryAudit();
    const service = new NotificationDeadLetterService(repository, queue, audit);

    await service.replay("dlq-1", "admin-1");

    expect(queue.messages).toEqual([repository.item.messageBody]);
    expect(repository.item.status).toBe("REPLAYED");
    expect(audit.records).toHaveLength(1);
  });

  it("rejects replay after the item is already closed", async () => {
    const repository = new MemoryDlq();
    repository.item = { ...repository.item, status: "REPLAYED" };
    const service = new NotificationDeadLetterService(repository, new MemoryQueue(), new MemoryAudit());

    await expect(service.replay("dlq-1", "admin-1")).rejects.toThrow("NOTIFICATION_DLQ_ALREADY_REPLAYED");
  });
});
