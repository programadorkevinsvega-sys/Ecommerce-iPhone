import { afterEach, describe, expect, it } from "vitest";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";
import { D1WebVitalsRepository } from "./D1WebVitalsRepository";

let database: D1SqliteTestDatabase;
afterEach(() => database.close());

function setup() {
  database = new D1SqliteTestDatabase();
  database.exec(`
    CREATE TABLE web_vitals_measurements (
      metric_id TEXT PRIMARY KEY,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      rating TEXT NOT NULL,
      route TEXT NOT NULL,
      environment TEXT NOT NULL,
      release TEXT,
      device_type TEXT NOT NULL,
      measured_at TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX idx_web_vitals_period
      ON web_vitals_measurements(measured_at,metric,route,environment);
  `);
  return new D1WebVitalsRepository(database.asD1());
}

function sample(overrides: Partial<Parameters<D1WebVitalsRepository["record"]>[0]> = {}) {
  return {
    metric: "LCP" as const,
    metricId: "web-vitals-test-0001",
    value: 2300,
    rating: "good" as const,
    route: "/",
    environment: "preview",
    release: "pr-26",
    deviceType: "desktop" as const,
    measuredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("D1WebVitalsRepository", () => {
  it("upserts duplicate metric IDs and exposes aggregate p75 without raw identifiers", async () => {
    const repository = setup();
    await repository.record(sample());
    await repository.record(sample({ value: 3000, rating: "needs-improvement" }));
    await repository.record(
      sample({
        metricId: "web-vitals-test-0002",
        value: 1800,
      }),
    );

    const report = await repository.summary(28);
    expect(report.periodDays).toBe(28);
    expect(report.p75).toEqual([
      expect.objectContaining({
        metric: "LCP",
        route: "/",
        environment: "preview",
        p75: 3000,
        sample_count: 2,
      }),
    ]);
    expect(JSON.stringify(report)).not.toContain("web-vitals-test-0001");
  });

  it("purges only expired measurements within the requested batch size", async () => {
    const repository = setup();
    await repository.record(
      sample({
        metricId: "web-vitals-expired-01",
        measuredAt: "2025-01-01T00:00:00.000Z",
      }),
    );
    database.exec(
      "UPDATE web_vitals_measurements SET expires_at=datetime('now','-1 day') WHERE metric_id=?",
      "web-vitals-expired-01",
    );
    await repository.record(sample({ metricId: "web-vitals-current-01" }));
    expect(await repository.purgeExpired(10)).toBe(1);
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM web_vitals_measurements")[0]
        ?.count,
    ).toBe(1);
  });
});
