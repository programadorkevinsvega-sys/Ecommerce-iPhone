import type { NotificationRecipient, NotificationChannel } from "../domain/NotificationEvent";

export type NotificationPreference = Readonly<{
  channel: NotificationChannel;
  eventType: string;
  enabled: boolean;
}>;

export interface NotificationPreferenceRepository {
  isEnabled(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    eventType: string,
  ): Promise<boolean>;
  list(recipient: NotificationRecipient): Promise<NotificationPreference[]>;
  set(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    eventType: string,
    enabled: boolean,
  ): Promise<void>;
}
