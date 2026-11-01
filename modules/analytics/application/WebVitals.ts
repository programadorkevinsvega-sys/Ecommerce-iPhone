export const WEB_VITAL_METRICS = ["LCP", "INP", "CLS"] as const;
export type WebVitalMetricName = (typeof WEB_VITAL_METRICS)[number];
export type WebVitalRating = "good" | "needs-improvement" | "poor";
export type WebVitalDeviceType = "mobile" | "tablet" | "desktop";
export type WebVitalInput = Readonly<{ metric: WebVitalMetricName; metricId: string; value: number; route: string; deviceType: WebVitalDeviceType }>;

const ROUTES = new Set(["/", "/catalog", "/iphone/:slug", "/cart", "/checkout", "/admin/login", "/other"]);
const DEVICE_TYPES = new Set<WebVitalDeviceType>(["mobile", "tablet", "desktop"]);

export function normalizeWebVitalRoute(pathname: string): string {
  if (ROUTES.has(pathname)) return pathname;
  if (/^\/iphone\/[^/]+\/?$/.test(pathname)) return "/iphone/:slug";
  return "/other";
}

export function rateWebVital(metric: WebVitalMetricName, value: number): WebVitalRating {
  if (!Number.isFinite(value) || value < 0) throw new Error("INVALID_WEB_VITAL_VALUE");
  const good = metric === "LCP" ? 2500 : metric === "INP" ? 200 : 0.1;
  const poor = metric === "LCP" ? 4000 : metric === "INP" ? 500 : 0.25;
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
}

export function parseWebVitalInput(value: unknown): WebVitalInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_WEB_VITAL_PAYLOAD");
  const body = value as Record<string, unknown>;
  const metric = body.metric;
  const metricId = body.metricId;
  const numericValue = body.value;
  const route = body.route;
  const deviceType = body.deviceType;
  if (typeof metric !== "string" || !WEB_VITAL_METRICS.includes(metric as WebVitalMetricName)) throw new Error("INVALID_WEB_VITAL_METRIC");
  if (typeof metricId !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(metricId)) throw new Error("INVALID_WEB_VITAL_ID");
  if (typeof numericValue !== "number" || !Number.isFinite(numericValue) || numericValue < 0) throw new Error("INVALID_WEB_VITAL_VALUE");
  const maxValue = metric === "LCP" ? 60000 : metric === "INP" ? 10000 : 10;
  if (numericValue > maxValue) throw new Error("INVALID_WEB_VITAL_VALUE");
  if (typeof route !== "string" || !ROUTES.has(route)) throw new Error("INVALID_WEB_VITAL_ROUTE");
  if (typeof deviceType !== "string" || !DEVICE_TYPES.has(deviceType as WebVitalDeviceType)) throw new Error("INVALID_WEB_VITAL_DEVICE");
  return { metric: metric as WebVitalMetricName, metricId, value: numericValue, route, deviceType: deviceType as WebVitalDeviceType };
}

export function percentile75(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)] ?? null;
}
