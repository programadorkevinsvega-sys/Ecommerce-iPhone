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
