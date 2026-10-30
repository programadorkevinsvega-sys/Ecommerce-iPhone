import { isClientAnalyticsEventType } from "../domain/AnalyticsEvent";
import type {
  AnalyticsPayload,
  ClientAnalyticsEventType,
} from "../domain/AnalyticsEvent";

export { isClientAnalyticsEventType };
export type AnalyticsClientEventType = ClientAnalyticsEventType;
export type AnalyticsClientPayload = AnalyticsPayload;
