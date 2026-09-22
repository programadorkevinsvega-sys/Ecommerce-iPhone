import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1NotificationOutboxRepository } from "../../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import type { NotificationEvent } from "../../../modules/notifications/domain/NotificationEvent";
import { notificationQueuePublisher } from "./notificationsApplication";

export async function publishNotificationEvent(
  input: Omit<NotificationEvent, "id" | "createdAt" | "eventVersion"> & {
    id?: string;
    eventVersion?: number | undefined;
  },
): Promise<void> {
  const { env } = getCloudflareContext();
  const event: NotificationEvent = {
    id: input.id ?? crypto.randomUUID(),
    eventVersion: input.eventVersion ?? 1,
    createdAt: new Date().toISOString(),
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    ...(input.recipients?.length ? { recipients: input.recipients } : {}),
  };

  const outbox = new D1NotificationOutboxRepository(env.DB);
  const inserted = await outbox.enqueue(event);
  if (!inserted) return;

  try {
    await notificationQueuePublisher(env).publish(event);
    if (await outbox.claim(event.id, 60)) {
      await outbox.markQueued(event.id);
    }
  } catch {
    // The durable outbox remains PENDING so the scheduled reconciler can republish it.
  }
}
