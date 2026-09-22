import type { NotificationEvent } from "../domain/NotificationEvent";

export interface NotificationQueuePort {
  publish(event: NotificationEvent): Promise<void>;
}
