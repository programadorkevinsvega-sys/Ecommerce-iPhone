import type { NotificationRecipient } from "../domain/NotificationEvent";
import type { NotificationInboxRepository } from "./NotificationInboxRepository";

export class NotificationInboxService {
  constructor(private readonly repository: NotificationInboxRepository) {}

  list(recipient: NotificationRecipient, limit: number, cursor?: string, unreadOnly = false) {
    return this.repository.list(
      recipient,
      Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
      cursor,
      unreadOnly,
    );
  }

  unreadCount(recipient: NotificationRecipient) {
    return this.repository.unreadCount(recipient);
  }

  markRead(recipient: NotificationRecipient, notificationId: string) {
    return this.repository.markRead(recipient, notificationId);
  }

  markAllRead(recipient: NotificationRecipient) {
    return this.repository.markAllRead(recipient);
  }
}
