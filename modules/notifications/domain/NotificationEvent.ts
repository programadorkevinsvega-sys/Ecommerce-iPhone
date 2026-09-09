export type NotificationEvent = Readonly<{
  id: string;
  eventType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type EmailTemplate =
  | "ORDER_CREATED"
  | "ORDER_PAID"
  | "ORDER_STATUS_CHANGED"
  | "SERVICE_REQUESTED"
  | "SERVICE_STATUS_CHANGED"
  | "ADMIN_ALERT";

export type NotificationChannel = "EMAIL";

export function eventKey(event: NotificationEvent): string {
  return `${event.eventType}:${event.aggregateId}:${event.id}`;
}
