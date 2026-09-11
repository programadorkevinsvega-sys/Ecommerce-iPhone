import type { NotificationEvent, EmailTemplate } from "../domain/NotificationEvent";
import { renderEmail } from "./NotificationTemplates";
import type { EmailProvider, NotificationOutboxRepository } from "./NotificationPorts";

const templateFor = (eventType:string): EmailTemplate | null => ({
  OrderCreated:"ORDER_CREATED", OrderPaid:"ORDER_PAID", OrderStatusChanged:"ORDER_STATUS_CHANGED",
  ServiceRequestCreated:"SERVICE_REQUESTED", ServiceStatusChanged:"SERVICE_STATUS_CHANGED"
}[eventType] as EmailTemplate | undefined) ?? null;

export class NotificationService {
  constructor(private readonly outbox: NotificationOutboxRepository, private readonly email: EmailProvider) {}

  async enqueue(event: NotificationEvent): Promise<boolean> { return this.outbox.enqueue(event); }

  async process(event: NotificationEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const recipient = String(payload.email ?? "").trim().toLowerCase();
    if (!recipient || !recipient.includes("@")) { await this.outbox.markProcessed(event.id); return; }
    const template = templateFor(event.eventType);
    if (!template) { await this.outbox.markProcessed(event.id); return; }
    if (await this.outbox.hasDelivery(event.id,"EMAIL",recipient,template)) { await this.outbox.markProcessed(event.id); return; }
    const rendered = renderEmail(template,payload);
    const idempotencyKey = `ecommerce-iphone/email/${event.eventType}/${event.aggregateId}/${event.id}`.slice(0, 256);
    try {
      const result = await this.email.send({to:recipient,...rendered,tags:{event_type:event.eventType,aggregate_id:event.aggregateId},idempotencyKey});
      await this.outbox.recordDelivery({outboxId:event.id,channel:"EMAIL",recipient,template,provider:"resend",providerMessageId:result.id,status:"SENT",attempts:1});
      await this.outbox.markProcessed(event.id);
    } catch (error) {
      const attempts = 1;
      const retryAt = new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString().replace('T',' ').replace('Z','');
      await this.outbox.recordDelivery({outboxId:event.id,channel:"EMAIL",recipient,template,provider:"resend",status:"FAILED",attempts,errorMessage:error instanceof Error?error.message:String(error)});
      await this.outbox.markFailed(event.id,error instanceof Error?error.message:String(error),retryAt);
      throw error;
    }
  }
}
