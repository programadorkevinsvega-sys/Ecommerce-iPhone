import type { NotificationEvent, NotificationInboxItem, NotificationRecipient } from "../domain/NotificationEvent";
import { notificationContent } from "../domain/NotificationEvent";
import { renderEmail } from "./NotificationTemplates";
import type { NotificationInboxRepository } from "./NotificationInboxRepository";
import type { NotificationRealtimePort } from "./NotificationRealtimePort";
import type { NotificationOutboxRepository, EmailProvider } from "./NotificationPorts";
import type { NotificationDeliveryRepository } from "./NotificationDeliveryRepository";
import type { NotificationPreferenceRepository } from "./NotificationPreferenceRepository";
import { NotificationProviderError, NotificationTerminalError } from "./NotificationProcessingError";

const templateFor = (eventType: string) => ({
  OrderCreated: "ORDER_CREATED",
  OrderPaid: "ORDER_PAID",
  OrderStatusChanged: "ORDER_STATUS_CHANGED",
  ServiceRequestCreated: "SERVICE_REQUESTED",
  ServiceStatusChanged: "SERVICE_STATUS_CHANGED",
} as const)[eventType];

type ProjectedRecipient = Readonly<{
  recipient: NotificationRecipient;
  item: NotificationInboxItem;
}>;

export class NotificationService {
  constructor(
    private readonly outbox: NotificationOutboxRepository,
    private readonly email: EmailProvider,
    private readonly inbox: NotificationInboxRepository,
    private readonly realtime: NotificationRealtimePort,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly preferences: NotificationPreferenceRepository,
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
    const projected = await this.projectInbox(event);
    const payload = event.payload as Record<string, unknown>;
    const recipientEmail = String(payload.email ?? "").trim().toLowerCase();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      await this.outbox.markProcessed(event.id);
      return;
    }

    const template = templateFor(event.eventType);
    if (!template) {
      await this.outbox.markProcessed(event.id);
      return;
    }

    const explicitRecipient = event.recipients?.find(
      (recipient) => recipient.email?.trim().toLowerCase() === recipientEmail,
    );
    const projectedRecipient = explicitRecipient
      ? projected.find((value) => value.recipient.id === explicitRecipient.id && value.recipient.type === explicitRecipient.type)
      : undefined;

    if (explicitRecipient && projectedRecipient) {
      if (!(await this.preferences.isEnabled(explicitRecipient, "EMAIL", event.eventType))) {
        await this.outbox.markProcessed(event.id);
        return;
      }

      await this.processLedgerEmail(
        event,
        projectedRecipient.item.id,
        explicitRecipient,
        recipientEmail,
        template,
        payload,
      );
      return;
    }

    await this.processLegacyEmail(event, recipientEmail, template, payload);
  }

  private async processLedgerEmail(
    event: NotificationEvent,
    notificationId: string,
    recipient: NotificationRecipient,
    recipientEmail: string,
    template: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (await this.deliveries.hasSentEmail(notificationId, recipient, recipientEmail)) {
      await this.outbox.markProcessed(event.id);
      return;
    }

    if (!(await this.deliveries.claimEmail(notificationId, recipient, recipientEmail, 900))) {
      throw new Error("Notification delivery is already being processed");
    }

    const rendered = renderEmail(template as Parameters<typeof renderEmail>[0], payload);
    const idempotencyKey = `ecommerce-iphone/email/${event.eventType}/${event.aggregateId}/${event.id}`.slice(0, 256);

    try {
      const result = await this.email.send({
        to: recipientEmail,
        ...rendered,
        tags: { event_type: event.eventType, aggregate_id: event.aggregateId },
        idempotencyKey,
      });
      await this.deliveries.recordEmail({
        notificationId,
        recipient,
        recipientEmail,
        provider: "resend",
        providerMessageId: result.id,
        status: "SENT",
      });
      await this.outbox.markProcessed(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = error instanceof NotificationProviderError ? error.retryable : true;
      await this.deliveries.recordEmail({
        notificationId,
        recipient,
        recipientEmail,
        provider: "resend",
        status: retryable ? "FAILED" : "TERMINAL",
        error: message,
      });
      if (retryable) {
        const retryAt = new Date(Date.now() + 60_000).toISOString().replace("T", " ").replace("Z", "");
        await this.outbox.markFailed(event.id, message, retryAt);
        throw error;
      }
      await this.outbox.markTerminal(event.id, message);
      throw new NotificationTerminalError(message);
    }
  }

  private async processLegacyEmail(
    event: NotificationEvent,
    recipient: string,
    template: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
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

    const rendered = renderEmail(template as Parameters<typeof renderEmail>[0], payload);
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
      const message = error instanceof Error ? error.message : String(error);
      const retryable = error instanceof NotificationProviderError ? error.retryable : true;
      if (retryable) {
        const retryAt = new Date(Date.now() + 60_000).toISOString().replace("T", " ").replace("Z", "");
        await this.outbox.recordDelivery({
          outboxId: event.id,
          channel: "EMAIL",
          recipient,
          template,
          provider: "resend",
          status: "FAILED",
          attempts: 1,
          errorMessage: message,
        });
        await this.outbox.markFailed(event.id, message, retryAt);
        throw error;
      }
      await this.outbox.recordDelivery({
        outboxId: event.id,
        channel: "EMAIL",
        recipient,
        template,
        provider: "resend",
        status: "FAILED",
        attempts: 1,
        errorMessage: message,
      });
      await this.outbox.markTerminal(event.id, message);
      throw new NotificationTerminalError(message);
    }
  }

  private async projectInbox(event: NotificationEvent): Promise<ProjectedRecipient[]> {
    if (!event.recipients?.length) return [];
    const content = notificationContent(event);
    const result: ProjectedRecipient[] = [];

    for (const recipient of event.recipients) {
      if (!(await this.preferences.isEnabled(recipient, "IN_APP", event.eventType))) continue;

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

      const created = await this.inbox.create(item);
      const existing = created ? item : await this.inbox.findByEventRecipient(event.id, recipient);
      if (existing) {
        await this.realtime.publish(existing);
        result.push({ recipient, item: existing });
      }
    }

    return result;
  }
}
