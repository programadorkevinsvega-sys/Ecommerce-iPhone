import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1NotificationOutboxRepository } from "../../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import type { NotificationEvent } from "../../../modules/notifications/domain/NotificationEvent";

export async function publishNotificationEvent(input: Omit<NotificationEvent,"id"|"createdAt"> & { id?: string }): Promise<void> {
  const { env } = getCloudflareContext();
  const event: NotificationEvent = { id: input.id ?? crypto.randomUUID(), createdAt:new Date().toISOString(), eventType:input.eventType, aggregateId:input.aggregateId, payload:input.payload };
  await new D1NotificationOutboxRepository(env.DB).enqueue(event);
}
