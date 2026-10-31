import type { NotificationOutboxRepository } from "./NotificationPorts";
import type { NotificationQueuePort } from "./NotificationQueuePort";

export type NotificationPublishResult = "published" | "deferred" | "retry-scheduled";

export interface NotificationPublishLogger {
  warn(message: string): void;
  error(message: string): void;
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(api[_-]?key|(?:access[_-]?|refresh[_-]?)?token|password|secret|authorization)\s*[:=]\s*["']?[^,\s"']+/gi,
      "$1=[REDACTED]",
    )
    .replace(/https?:\/\/[^/\s:@]+:[^@\s]+@/gi, "https://[REDACTED]@")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

export class PublishPersistedNotification {
  constructor(
    private readonly outbox: NotificationOutboxRepository,
    private readonly queue: NotificationQueuePort,
    private readonly logger: NotificationPublishLogger = console,
  ) {}

  async execute(eventId: string): Promise<NotificationPublishResult> {
    const event = await this.outbox.findById(eventId);
    if (!event) throw new Error("NOTIFICATION_OUTBOX_NOT_FOUND");
    if (event.status === "PROCESSED" || event.status === "QUEUED" || event.terminalAt) {
      return "deferred";
    }
    if (!(await this.outbox.claim(eventId, 60))) return "deferred";

    try {
      await this.queue.publish(event);
      await this.outbox.markQueued(eventId);
      return "published";
    } catch (error) {
      const safeMessage = sanitizeError(error);
      const retryAt = new Date(Date.now() + 60_000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      try {
        await this.outbox.markFailed(eventId, safeMessage, retryAt);
      } catch (persistError) {
        this.logger.error(
          JSON.stringify({
            event: "notification_outbox_publish_failure_persistence_failed",
            eventId,
            message: sanitizeError(persistError),
          }),
        );
      }
      this.logger.warn(
        JSON.stringify({
          event: "notification_queue_publish_failed",
          eventId,
          message: safeMessage,
        }),
      );
      return "retry-scheduled";
    }
  }
}
