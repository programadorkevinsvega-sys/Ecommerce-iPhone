export const ANALYTICS_EVENT_TYPES = [
  "VisitorStarted",
  "SessionStarted",
  "ProductViewed",
  "SearchPerformed",
  "SearchResultClicked",
  "CategoryNavigated",
  "FilterApplied",
  "PaginationChanged",
  "ProductVariantSelected",
  "RelatedProductClicked",
  "CartItemAdded",
  "CartItemRemoved",
  "CartAbandoned",
  "CheckoutStarted",
  "ShippingMethodSelected",
  "PaymentStarted",
  "PurchaseCompleted",
  "RevenueRecorded",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];
export type AnalyticsScalar = string | number | boolean | null;
export type AnalyticsPayload = Readonly<Record<string, AnalyticsScalar>>;
export type AnalyticsSource = "web" | "server";

export const SERVER_OWNED_ANALYTICS_EVENT_TYPES = [
  "CartItemAdded",
  "CartItemRemoved",
  "CartAbandoned",
  "CheckoutStarted",
  "PaymentStarted",
  "PurchaseCompleted",
  "RevenueRecorded",
] as const satisfies readonly AnalyticsEventType[];

export type ServerOwnedAnalyticsEventType =
  (typeof SERVER_OWNED_ANALYTICS_EVENT_TYPES)[number];
export type ClientAnalyticsEventType = Exclude<
  AnalyticsEventType,
  ServerOwnedAnalyticsEventType
>;

export type AnalyticsEvent = Readonly<{
  eventId: string;
  eventType: AnalyticsEventType;
  eventVersion: 1;
  occurredAt: string;
  receivedAt: string;
  sessionId: string;
  visitorId: string;
  requestId?: string | undefined;
  source: AnalyticsSource;
  payload: AnalyticsPayload;
}>;

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && ANALYTICS_EVENT_TYPES.includes(value as AnalyticsEventType);
}

export function isServerOwnedAnalyticsEventType(
  value: unknown,
): value is ServerOwnedAnalyticsEventType {
  return (
    typeof value === "string" &&
    SERVER_OWNED_ANALYTICS_EVENT_TYPES.includes(value as ServerOwnedAnalyticsEventType)
  );
}

export function isClientAnalyticsEventType(
  value: unknown,
): value is ClientAnalyticsEventType {
  return isAnalyticsEventType(value) && !isServerOwnedAnalyticsEventType(value);
}
