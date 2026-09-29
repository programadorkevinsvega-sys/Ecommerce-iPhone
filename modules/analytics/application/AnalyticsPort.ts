import type { AnalyticsEvent } from "../domain/AnalyticsEvent";
export interface AnalyticsPort { record(event: AnalyticsEvent): Promise<void>; }
