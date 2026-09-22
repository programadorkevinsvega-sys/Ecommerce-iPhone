import type { Queue } from "@cloudflare/workers-types";
import type { NotificationQueuePort } from "../application/NotificationQueuePort";
import type { NotificationEvent } from "../domain/NotificationEvent";

export class CloudflareNotificationQueuePublisher implements NotificationQueuePort {
  constructor(private readonly queue: Queue) {}

  async publish(event: NotificationEvent): Promise<void> {
    await this.queue.send(JSON.stringify({
      schemaVersion: event.eventVersion,
      outboxId: event.id,
    }));
  }
}
