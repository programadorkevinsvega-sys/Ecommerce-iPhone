import type {
  WebVitalMeasurement,
  WebVitalsRepository,
  WebVitalsSummary,
} from "./WebVitalsRepository";

export class WebVitalsService {
  constructor(private readonly repository: WebVitalsRepository) {}

  record(input: WebVitalMeasurement): Promise<boolean> {
    return this.repository.record(input);
  }

  summary(days = 28): Promise<WebVitalsSummary> {
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new Error("INVALID_WEB_VITALS_PERIOD");
    }
    return this.repository.summary(days);
  }

  purgeExpired(limit = 500): Promise<number> {
    return this.repository.purgeExpired(limit);
  }
}
