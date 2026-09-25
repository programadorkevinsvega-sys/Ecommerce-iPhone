import type { NotificationAuditPort } from "./NotificationAuditPort";
import type { NotificationDeadLetterRepository } from "./NotificationDeadLetterRepository";
import type { NotificationRawQueuePort } from "./NotificationRawQueuePort";

export class NotificationDeadLetterService {
  constructor(
    private readonly repository: NotificationDeadLetterRepository,
    private readonly queue: NotificationRawQueuePort,
    private readonly audit: NotificationAuditPort,
  ) {}

  async record(input: { id: string; queueName: string; messageId?: string | undefined; messageBody: string }): Promise<void> {
    await this.repository.record(input);
  }

  list(limit: number) {
    return this.repository.list(Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50);
  }

  async replay(id: string, adminId: string): Promise<void> {
    const item = await this.repository.find(id);
    if (!item) throw new Error("NOTIFICATION_DLQ_NOT_FOUND");
    if (item.status === "REPLAYED") throw new Error("NOTIFICATION_DLQ_ALREADY_REPLAYED");

    await this.queue.publishRaw(item.messageBody);
    const marked = await this.repository.markReplayed(id, adminId);
    if (!marked) throw new Error("NOTIFICATION_DLQ_REPLAY_CONFLICT");

    await this.audit.record({
      actorId: adminId,
      action: "NOTIFICATION_DLQ_REPLAYED",
      resourceType: "notification_dead_letter",
      resourceId: id,
      payload: { queueName: item.queueName, messageId: item.messageId ?? null, attempts: item.attempts },
    });
  }
}
