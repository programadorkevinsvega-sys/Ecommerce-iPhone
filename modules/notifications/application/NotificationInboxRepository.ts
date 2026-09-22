import type { NotificationRecipient, NotificationInboxItem } from "../domain/NotificationEvent";

export interface NotificationInboxRepository {
  create(item: NotificationInboxItem): Promise<boolean>;
  list(
    recipient: NotificationRecipient,
    limit: number,
    cursor?: string,
    unreadOnly?: boolean,
  ): Promise<{ items: NotificationInboxItem[]; nextCursor: string | null }>;
  unreadCount(recipient: NotificationRecipient): Promise<number>;
  markRead(recipient: NotificationRecipient, notificationId: string): Promise<boolean>;
  markAllRead(recipient: NotificationRecipient): Promise<number>;
}
