import type { NotificationRecipient } from "../domain/NotificationEvent";

export interface NotificationDeliveryRepository {
  hasSentEmail(notificationId: string, recipient: NotificationRecipient, recipientEmail: string): Promise<boolean>;
  claimEmail(
    notificationId: string,
    recipient: NotificationRecipient,
    recipientEmail: string,
    leaseSeconds: number,
  ): Promise<boolean>;
  recordEmail(input: {
    notificationId: string;
    recipient: NotificationRecipient;
    recipientEmail: string;
    provider: string;
    providerMessageId?: string | undefined;
    status: "SENT" | "FAILED" | "TERMINAL";
    error?: string | undefined;
  }): Promise<void>;
}
