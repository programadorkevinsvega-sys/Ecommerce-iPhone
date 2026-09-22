export type NotificationRecipientType = "customer" | "technician" | "admin";

export type NotificationRecipient = Readonly<{
  type: NotificationRecipientType;
  id: string;
  email?: string | undefined;
}>;

export type NotificationInboxItem = Readonly<{
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  recipientType: NotificationRecipientType;
  recipientId: string;
  title: string;
  body: string;
  payload: Readonly<Record<string, unknown>>;
  createdAt: string;
  readAt?: string | undefined;
  expiresAt?: string | undefined;
}>;

export type NotificationEvent = Readonly<{
  id: string;
  eventType: string;
  eventVersion: number;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
  createdAt: string;
  recipients?: readonly NotificationRecipient[] | undefined;
}>;

export type EmailTemplate =
  | "ORDER_CREATED"
  | "ORDER_PAID"
  | "ORDER_STATUS_CHANGED"
  | "SERVICE_REQUESTED"
  | "SERVICE_STATUS_CHANGED"
  | "ADMIN_ALERT";

export type NotificationChannel = "EMAIL" | "IN_APP";

export function eventKey(event: NotificationEvent): string {
  return `${event.eventType}:${event.aggregateId}:${event.id}`;
}

const SAFE_NOTIFICATION_KEYS = new Set([
  "orderId",
  "orderNumber",
  "serviceRequestId",
  "serviceId",
  "status",
  "message",
  "messageTitle",
  "notificationTitle",
  "notificationBody",
  "aggregateId",
]);

export function safeNotificationPayload(event: NotificationEvent): Readonly<Record<string, unknown>> {
  const source = event.payload as Record<string, unknown>;
  const result: Record<string, unknown> = {
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    aggregateId: event.aggregateId,
  };
  for (const [key, value] of Object.entries(source)) {
    if (SAFE_NOTIFICATION_KEYS.has(key)) result[key] = value;
  }
  return result;
}

export function notificationContent(event: NotificationEvent): Pick<NotificationInboxItem, "title" | "body"> {
  const payload = event.payload as Record<string, unknown>;
  const orderNumber = String(payload.orderNumber ?? payload.orderId ?? "");
  const serviceId = String(payload.serviceRequestId ?? payload.serviceId ?? "");
  const status = String(payload.status ?? "");
  const title =
    String(payload.notificationTitle ?? "").trim() ||
    (event.eventType === "OrderPaid" ? "Pago confirmado" :
     event.eventType === "OrderCreated" ? "Pedido recibido" :
     event.eventType === "OrderStatusChanged" ? "Actualización de tu pedido" :
     event.eventType === "ServiceRequestCreated" ? "Solicitud de servicio recibida" :
     event.eventType === "ServiceStatusChanged" ? "Actualización de tu servicio" :
     String(payload.messageTitle ?? event.eventType));
  const body =
    String(payload.notificationBody ?? "").trim() ||
    (event.eventType.startsWith("Order") ? `Tu pedido ${orderNumber} está en estado ${status || "actualizado"}.` :
     event.eventType.startsWith("Service") ? `Tu solicitud de servicio ${serviceId} está en estado ${status || "actualizada"}.` :
     String(payload.message ?? "Tienes una nueva notificación."));
  return { title, body };
}
