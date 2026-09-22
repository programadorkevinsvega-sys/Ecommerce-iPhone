import type { NotificationRecipient, NotificationChannel } from "../domain/NotificationEvent";

export interface NotificationPreferenceRepository {
  isEnabled(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    eventType: string,
  ): Promise<boolean>;
}
