import { D1NotificationInboxRepository } from "../../modules/notifications/infrastructure/D1NotificationInboxRepository";
import { D1NotificationOutboxRepository } from "../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import { CloudflareNotificationQueuePublisher } from "../../modules/notifications/infrastructure/CloudflareNotificationQueuePublisher";
import { CloudflareNotificationRealtimePublisher } from "../../modules/notifications/infrastructure/CloudflareNotificationRealtimePublisher";
import { CloudflareNotificationRawQueuePublisher } from "../../modules/notifications/infrastructure/CloudflareNotificationRawQueuePublisher";
import { D1NotificationDeadLetterRepository } from "../../modules/notifications/infrastructure/D1NotificationDeadLetterRepository";
import { D1NotificationAuditPort } from "../../modules/notifications/infrastructure/D1NotificationAuditPort";
import { NotificationDeadLetterService } from "../../modules/notifications/application/NotificationDeadLetterService";
import { ResendEmailProvider } from "../../modules/notifications/infrastructure/ResendEmailProvider";
import { NotificationInboxService } from "../../modules/notifications/application/NotificationInboxService";
import { NotificationService } from "../../modules/notifications/application/NotificationService";

export function notificationProcessingApplication(env: CloudflareEnv): NotificationService {
  return new NotificationService(
    new D1NotificationOutboxRepository(env.DB),
    new ResendEmailProvider(env.RESEND_API_KEY ?? "", env.EMAIL_FROM ?? ""),
    new D1NotificationInboxRepository(env.DB),
    new CloudflareNotificationRealtimePublisher(env.NOTIFICATION_HUB),
  );
}

export function notificationInboxApplication(env: CloudflareEnv): NotificationInboxService {
  return new NotificationInboxService(new D1NotificationInboxRepository(env.DB));
}

export function notificationQueuePublisher(env: CloudflareEnv): CloudflareNotificationQueuePublisher {
  return new CloudflareNotificationQueuePublisher(env.NOTIFICATIONS_QUEUE);
}

export function notificationDeadLetterApplication(env: CloudflareEnv): NotificationDeadLetterService {
  return new NotificationDeadLetterService(
    new D1NotificationDeadLetterRepository(env.DB),
    new CloudflareNotificationRawQueuePublisher(env.NOTIFICATIONS_QUEUE),
    new D1NotificationAuditPort(env.DB),
  );
}
