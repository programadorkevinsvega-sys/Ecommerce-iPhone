import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NotificationRecipient } from "../../../modules/notifications/domain/NotificationEvent";
import { notificationInboxApplication } from "../notificationsApplication";

export async function listNotifications(
  recipient: NotificationRecipient,
  limit: number,
  cursor?: string,
  unreadOnly = false,
) {
  const { env } = getCloudflareContext();
  return notificationInboxApplication(env).list(recipient, limit, cursor, unreadOnly);
}

export async function unreadNotificationCount(recipient: NotificationRecipient) {
  const { env } = getCloudflareContext();
  return notificationInboxApplication(env).unreadCount(recipient);
}

export async function markNotificationRead(
  recipient: NotificationRecipient,
  notificationId: string,
) {
  const { env } = getCloudflareContext();
  return notificationInboxApplication(env).markRead(recipient, notificationId);
}

export async function markAllNotificationsRead(recipient: NotificationRecipient) {
  const { env } = getCloudflareContext();
  return notificationInboxApplication(env).markAllRead(recipient);
}

export async function upgradeNotificationRealtime(
  request: Request,
  recipient: NotificationRecipient,
): Promise<Response> {
  const { env } = getCloudflareContext();
  const origin = request.headers.get("origin");
  if (!origin || origin !== env.ALLOWED_ORIGIN) {
    return new Response("Origin not allowed.", { status: 403 });
  }

  const id = env.NOTIFICATION_HUB.idFromName(
    `notification:${recipient.type}:${recipient.id}`,
  );
  return env.NOTIFICATION_HUB.get(id).fetch(
    new Request("https://notification-hub/realtime", {
      method: "GET",
      headers: request.headers,
    }),
  );
}

import { notificationDeadLetterApplication } from "../notificationsApplication";

export async function listNotificationDeadLetters(limit: number) {
  const { env } = getCloudflareContext();
  return notificationDeadLetterApplication(env).list(limit);
}

export async function replayNotificationDeadLetter(id: string, adminId: string) {
  const { env } = getCloudflareContext();
  return notificationDeadLetterApplication(env).replay(id, adminId);
}
