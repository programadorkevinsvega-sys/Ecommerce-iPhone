import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { NotificationRealtimePort } from "../application/NotificationRealtimePort";
import type { NotificationInboxItem } from "../domain/NotificationEvent";

export class CloudflareNotificationRealtimePublisher implements NotificationRealtimePort {
  constructor(private readonly namespace: DurableObjectNamespace) {}

  async publish(item: NotificationInboxItem): Promise<void> {
    const id = this.namespace.idFromName(`notification:${item.recipientType}:${item.recipientId}`);
    const stub = this.namespace.get(id);
    const response = await stub.fetch("https://notification-hub/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      throw new Error(`NOTIFICATION_REALTIME_PUBLISH_FAILED:${response.status}`);
    }
  }
}
