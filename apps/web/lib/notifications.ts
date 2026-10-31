import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PublishPersistedNotification } from "../../../modules/notifications/application/PublishPersistedNotification";
import { D1NotificationOutboxRepository } from "../../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import type { NotificationEvent } from "../../../modules/notifications/domain/NotificationEvent";
import { notificationQueuePublisher } from "./notificationsApplication";
import { logServerError } from "./serverLogger";

async function publishStoredNotification(
  env: CloudflareEnv,
  outbox: D1NotificationOutboxRepository,
  eventId: string,
): Promise<void> {
  await new PublishPersistedNotification(outbox, notificationQueuePublisher(env)).execute(eventId);
}

/** Publish an event whose durable outbox row was committed with its business transaction. */
export async function publishPersistedNotificationEvent(eventId: string): Promise<void> {
  try {
    const { env } = getCloudflareContext();
    const outbox = new D1NotificationOutboxRepository(env.DB);
    await publishStoredNotification(env, outbox, eventId);
  } catch (error) {
    logServerError(
      "notification_outbox_post_commit_publish_failed",
      new Error(error instanceof Error ? error.name : "UnknownError"),
      { eventId },
    );
  }
}

/** Persist a standalone event once, then publish the durable record to Queue. */
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
  await publishStoredNotification(env, outbox, event.id);
}
