import type { D1Database } from "@cloudflare/workers-types";
import type {
  WebVitalDistributionRow,
  WebVitalMeasurement,
  WebVitalP75Row,
  WebVitalTrendRow,
  WebVitalsRepository,
  WebVitalsSummary,
} from "../application/WebVitalsRepository";

export class D1WebVitalsRepository implements WebVitalsRepository {
  constructor(private readonly db: D1Database) {}

  async record(input: WebVitalMeasurement): Promise<boolean> {
    const result = await this.db
      .prepare(
        `INSERT INTO web_vitals_measurements
       (metric_id,metric,value,rating,route,environment,release,device_type,measured_at,expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,datetime('now','+180 days'))
       ON CONFLICT(metric_id) DO UPDATE SET
         value=excluded.value,rating=excluded.rating,route=excluded.route,
         environment=excluded.environment,release=excluded.release,
         device_type=excluded.device_type,measured_at=excluded.measured_at,
         expires_at=excluded.expires_at`,
      )
      .bind(
        input.metricId,
        input.metric,
        input.value,
        input.rating,
        input.route,
        input.environment,
        input.release,
        input.deviceType,
        input.measuredAt,
      )
      .run();
    return result.meta.changes === 1;
  }

  async summary(days = 28): Promise<WebVitalsSummary> {
    const periodDays = Math.max(1, Math.min(90, Math.trunc(days)));
    const modifier = `-${periodDays} days`;
    const p75 = await this.db
      .prepare(
        `WITH ranked AS (
        SELECT metric,route,environment,value,
          COUNT(*) OVER (PARTITION BY metric,route,environment) AS sample_count,
          ROW_NUMBER() OVER (PARTITION BY metric,route,environment ORDER BY value ASC) AS row_number
        FROM web_vitals_measurements WHERE measured_at >= datetime('now', ?)
      )
      SELECT metric,route,environment,value AS p75,sample_count FROM ranked
      WHERE row_number = MAX(1, CAST(sample_count * 0.75 + 0.999999 AS INTEGER))
      ORDER BY metric,route,environment`,
      )
      .bind(modifier)
      .all<WebVitalP75Row>();
    const ratingDistribution = await this.db
      .prepare(
        `SELECT metric,route,environment,rating,COUNT(*) AS sample_count
       FROM web_vitals_measurements WHERE measured_at >= datetime('now', ?)
       GROUP BY metric,route,environment,rating ORDER BY metric,route,environment,rating`,
      )
      .bind(modifier)
      .all<WebVitalDistributionRow>();
    const weeklyTrend = await this.db
      .prepare(
        `SELECT metric,route,environment,strftime('%Y-%W', measured_at) AS period,AVG(value) AS average,COUNT(*) AS sample_count
       FROM web_vitals_measurements WHERE measured_at >= datetime('now', ?)
       GROUP BY metric,route,environment,period ORDER BY period,metric,route,environment`,
      )
      .bind(modifier)
      .all<WebVitalTrendRow>();
    return {
      periodDays,
      p75: p75.results,
      ratingDistribution: ratingDistribution.results,
      weeklyTrend: weeklyTrend.results,
    };
  }

  async purgeExpired(limit = 500): Promise<number> {
    const safeLimit = Math.max(1, Math.min(5000, Math.trunc(limit)));
    const result = await this.db
      .prepare(
        `DELETE FROM web_vitals_measurements WHERE metric_id IN (
        SELECT metric_id FROM web_vitals_measurements WHERE expires_at <= CURRENT_TIMESTAMP LIMIT ?
      )`,
      )
      .bind(safeLimit)
      .run();
    return result.meta.changes;
  }
}
