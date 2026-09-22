import type { NotificationChannel, NotificationRecipient } from "../domain/NotificationEvent";
import type { NotificationPreferenceRepository } from "./NotificationPreferenceRepository";

export type NotificationPreference = Readonly<{
  channel: NotificationChannel;
  eventType: string;
  enabled: boolean;
}>;

export class NotificationPreferenceService {
  constructor(private readonly repository: NotificationPreferenceRepository) {}

  get(recipient: NotificationRecipient) {
    return this.repository.list(recipient);
  }

  set(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    eventType: string,
    enabled: boolean,
  ) {
    return this.repository.set(recipient, channel, eventType, enabled);
  }
}
