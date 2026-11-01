import type {
  WebVitalDeviceType,
  WebVitalMetricName,
  WebVitalRating,
} from "./WebVitals";

export type WebVitalMeasurement = Readonly<{
  metric: WebVitalMetricName;
  metricId: string;
  value: number;
  rating: WebVitalRating;
  route: string;
  environment: string;
  release: string | null;
  deviceType: WebVitalDeviceType;
  measuredAt: string;
}>;

export type WebVitalP75Row = Readonly<{
  metric: WebVitalMetricName;
  route: string;
  environment: string;
  p75: number;
  sample_count: number;
}>;

export type WebVitalDistributionRow = Readonly<{
  metric: WebVitalMetricName;
  route: string;
  environment: string;
  rating: WebVitalRating;
  sample_count: number;
}>;

export type WebVitalTrendRow = Readonly<{
  metric: WebVitalMetricName;
  route: string;
  environment: string;
  period: string;
  average: number;
  sample_count: number;
}>;

export type WebVitalsSummary = Readonly<{
  periodDays: number;
  p75: WebVitalP75Row[];
  ratingDistribution: WebVitalDistributionRow[];
  weeklyTrend: WebVitalTrendRow[];
}>;

export interface WebVitalsRepository {
  record(input: WebVitalMeasurement): Promise<boolean>;
  summary(days?: number): Promise<WebVitalsSummary>;
  purgeExpired(limit?: number): Promise<number>;
}
