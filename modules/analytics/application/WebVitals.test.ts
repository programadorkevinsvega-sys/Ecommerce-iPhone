import { describe, expect, it } from "vitest";
import {
  normalizeWebVitalRoute,
  parseWebVitalInput,
  percentile75,
  rateWebVital,
} from "./WebVitals";

describe("Web Vitals policy", () => {
  it("normalizes product routes and strips unknown path dimensions", () => {
    expect(normalizeWebVitalRoute("/iphone/iphone-17-pro-max")).toBe("/iphone/:slug");
    expect(normalizeWebVitalRoute("/catalog")).toBe("/catalog");
    expect(normalizeWebVitalRoute("/catalog/private?email=hidden")).toBe("/other");
  });
  it("classifies LCP, INP and CLS at the standard boundaries", () => {
    expect(rateWebVital("LCP", 2500)).toBe("good");
    expect(rateWebVital("LCP", 4001)).toBe("poor");
    expect(rateWebVital("INP", 200)).toBe("good");
    expect(rateWebVital("INP", 501)).toBe("poor");
    expect(rateWebVital("CLS", 0.1)).toBe("good");
    expect(rateWebVital("CLS", 0.251)).toBe("poor");
  });
  it("rejects unknown metrics, unsafe route values and out-of-range inputs", () => {
    expect(() =>
      parseWebVitalInput({
        metric: "FID",
        metricId: "metric-invalid-001",
        value: 12,
        route: "/",
        deviceType: "desktop",
      }),
    ).toThrow("INVALID_WEB_VITAL_METRIC");
    expect(() =>
      parseWebVitalInput({
        metric: "LCP",
        metricId: "metric-invalid-002",
        value: 60001,
        route: "/",
        deviceType: "desktop",
      }),
    ).toThrow("INVALID_WEB_VITAL_VALUE");
    expect(() =>
      parseWebVitalInput({
        metric: "CLS",
        metricId: "metric-invalid-003",
        value: 0.1,
        route: "/checkout?email=x",
        deviceType: "desktop",
      }),
    ).toThrow("INVALID_WEB_VITAL_ROUTE");
  });
  it("computes p75 without mutating source values", () => {
    const source = [300, 100, 400, 200];
    expect(percentile75(source)).toBe(300);
    expect(source).toEqual([300, 100, 400, 200]);
    expect(percentile75([])).toBeNull();
  });
});
