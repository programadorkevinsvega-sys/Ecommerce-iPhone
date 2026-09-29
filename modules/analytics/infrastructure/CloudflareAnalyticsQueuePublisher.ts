import type { Queue } from "@cloudflare/workers-types";
import type { AnalyticsPort } from "../application/AnalyticsPort";
import type { AnalyticsEvent } from "../domain/AnalyticsEvent";
export class CloudflareAnalyticsQueuePublisher implements AnalyticsPort {
  constructor(private readonly queue: Queue) {}
  async record(event: AnalyticsEvent): Promise<void> {
    await this.queue.send(JSON.stringify({ kind: "analytics", schemaVersion: 1, event }));
  }
}
