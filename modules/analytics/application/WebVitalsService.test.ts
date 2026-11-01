import { describe, expect, it, vi } from "vitest";
import { WebVitalsService } from "./WebVitalsService";
import type { WebVitalsRepository, WebVitalsSummary } from "./WebVitalsRepository";

describe("WebVitalsService", () => {
  it("delegates validated field measurements to its repository", async () => {
    const repository: WebVitalsRepository = {
      record: vi.fn().mockResolvedValue(true),
      summary: vi.fn().mockResolvedValue({
        periodDays: 7,
        p75: [],
        ratingDistribution: [],
        weeklyTrend: [],
      } satisfies WebVitalsSummary),
      purgeExpired: vi.fn().mockResolvedValue(0),
    };
    const service = new WebVitalsService(repository);
    const input = {
      metric: "LCP" as const,
      metricId: "web-vitals-test-0001",
      value: 2300,
      rating: "good" as const,
      route: "/",
      environment: "local",
      release: null,
      deviceType: "desktop" as const,
      measuredAt: new Date().toISOString(),
    };

    await expect(service.record(input)).resolves.toBe(true);
    expect(repository.record).toHaveBeenCalledWith(input);
    await expect(service.summary(7)).resolves.toMatchObject({ periodDays: 7 });
    expect(repository.summary).toHaveBeenCalledWith(7);
    await expect(service.purgeExpired(100)).resolves.toBe(0);
    expect(repository.purgeExpired).toHaveBeenCalledWith(100);
  });

  it("rejects report windows outside one to ninety days", async () => {
    const repository: WebVitalsRepository = {
      record: vi.fn(),
      summary: vi.fn(),
      purgeExpired: vi.fn(),
    };
    const service = new WebVitalsService(repository);
    expect(() => service.summary(0)).toThrow("INVALID_WEB_VITALS_PERIOD");
    expect(() => service.summary(91)).toThrow("INVALID_WEB_VITALS_PERIOD");
  });
});
