import type { NotificationEvent, NotificationInboxItem } from "../domain/NotificationEvent";
import { notificationContent } from "../domain/NotificationEvent";
import { renderEmail } from "./NotificationTemplates";
import type { NotificationInboxRepository } from "./NotificationInboxRepository";
import type { NotificationRealtimePort } from "./NotificationRealtimePort";
import type { NotificationOutboxRepository, EmailProvider } from "./NotificationPorts";

const templateFor = (eventType: string) => ({
  OrderCreated: "ORDER_CREATED",
  OrderPaid: "ORDER_PAID",
  OrderStatusChanged: "ORDER_STATUS_CHANGED",
  ServiceRequestCreated: "SERVICE_REQUESTED",
  ServiceStatusChanged: "SERVICE_STATUS_CHANGED",
} as const)[eventType];

export class NotificationService {
  constructor(
    private readonly outbox: NotificationOutboxRepository,
    private readonly email: EmailProvider,
    private readonly inbox: NotificationInboxRepository,
    private readonly realtime: NotificationRealtimePort,
  ) {}

  async enqueue(event: NotificationEvent): Promise<boolean> {
    return this.outbox.enqueue(event);
  }

  async processByOutboxId(outboxId: string): Promise<void> {
    const record = await this.outbox.findById(outboxId);
    if (!record) throw new Error("NOTIFICATION_OUTBOX_NOT_FOUND");
    if (!(await this.outbox.claim(outboxId, 900))) return;
    await this.process(record);
  }

  async process(event: NotificationEvent): Promise<void> {
    await this.projectInbox(event);

    const payload = event.payload as Record<string, unknown>;
    const recipient = String(payload.email ?? "").trim().toLowerCase();
    if (!recipient || !recipient.includes("@")) {
      await this.outbox.markProcessed(event.id);
      return;
    }

    const template = templateFor(event.eventType);
    if (!template) {
      await this.outbox.markProcessed(event.id);
      return;
    }

    if (await this.outbox.hasDelivery(event.id, "EMAIL", recipient, template)) {
      await this.outbox.markProcessed(event.id);
      return;
    }

    const claimed = await this.outbox.claimDelivery({
      outboxId: event.id,
      channel: "EMAIL",
      recipient,
      template,
      leaseSeconds: 900,
    });
    if (!claimed) throw new Error("Notification delivery is already being processed");

    const rendered = renderEmail(template, payload);
    const idempotencyKey = `ecommerce-iphone/email/${event.eventType}/${event.aggregateId}/${event.id}`.slice(0, 256);

    try {
      const result = await this.email.send({
        to: recipient,
        ...rendered,
        tags: { event_type: event.eventType, aggregate_id: event.aggregateId },
        idempotencyKey,
      });
      await this.outbox.recordDelivery({
        outboxId: event.id,
        channel: "EMAIL",
        recipient,
        template,
        provider: "resend",
        providerMessageId: result.id,
        status: "SENT",
        attempts: 1,
      });
      await this.outbox.markProcessed(event.id);
    } catch (error) {
      const attempts = 1;
      const retryAt = new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
      await this.outbox.recordDelivery({
        outboxId: event.id,
        channel: "EMAIL",
        recipient,
        template,
        provider: "resend",
        status: "FAILED",
        attempts,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      await this.outbox.markFailed(
        event.id,
        error instanceof Error ? error.message : String(error),
        retryAt,
      );
      throw error;
    }
  }

  private async projectInbox(event: NotificationEvent): Promise<void> {
    if (!event.recipients?.length) return;
    const content = notificationContent(event);

    for (const recipient of event.recipients) {
      const item: NotificationInboxItem = {
        id: crypto.randomUUID(),
        eventId: event.id,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        recipientType: recipient.type,
        recipientId: recipient.id,
        title: content.title,
        body: content.body,
        payload: event.payload,
        createdAt: event.createdAt,
      };

      if (await this.inbox.create(item)) {
        await this.realtime.publish(item);
      }
    }
  }
}
