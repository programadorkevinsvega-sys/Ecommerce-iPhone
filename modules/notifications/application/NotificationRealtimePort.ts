import type { NotificationInboxItem } from "../domain/NotificationEvent";

export interface NotificationRealtimePort {
  publish(item: NotificationInboxItem): Promise<void>;
}
