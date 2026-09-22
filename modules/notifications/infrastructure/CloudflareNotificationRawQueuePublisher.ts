import type { Queue } from "@cloudflare/workers-types";
import type { NotificationRawQueuePort } from "../application/NotificationRawQueuePort";

export class CloudflareNotificationRawQueuePublisher implements NotificationRawQueuePort {
  constructor(private readonly queue: Queue) {}
  async publishRaw(message: string): Promise<void> {
    await this.queue.send(message);
  }
}
