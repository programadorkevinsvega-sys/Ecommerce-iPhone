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
