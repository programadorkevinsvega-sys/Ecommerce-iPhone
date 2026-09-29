import { describe, expect, it } from "vitest";
import type { AnalyticsEvent } from "../domain/AnalyticsEvent";
import type { AnalyticsPort } from "./AnalyticsPort";
import { AnalyticsService } from "./AnalyticsService";
class RecordingPort implements AnalyticsPort {
  readonly events: AnalyticsEvent[] = [];
  async record(event: AnalyticsEvent): Promise<void> { this.events.push(event); }
}
const ids = { eventId:"evt_01JTESTANALYTICS01", sessionId:"ses_01JTESTANALYTICS01", visitorId:"vis_01JTESTANALYTICS01" };
describe("AnalyticsService", () => {
  it("creates a versioned web event", async () => {
    const port = new RecordingPort(); const service = new AnalyticsService(port);
    await service.record({...ids,eventType:"ProductViewed",occurredAt:"2026-09-29T00:00:00.000Z",payload:{productId:"prod_123",slug:"iphone-16"}});
    expect(port.events).toHaveLength(1); expect(port.events[0]?.eventVersion).toBe(1);
    expect(port.events[0]?.source).toBe("web"); expect(port.events[0]?.receivedAt).toBeTruthy();
  });
  it("rejects sensitive fields before infrastructure", async () => {
    const port = new RecordingPort(); const service = new AnalyticsService(port);
    await expect(service.record({...ids,eventType:"ProductViewed",occurredAt:"2026-09-29T00:00:00.000Z",payload:{productId:"prod_123",email:"forbidden@example.com"}})).rejects.toThrow("ANALYTICS_SENSITIVE_FIELD");
    expect(port.events).toHaveLength(0);
  });
});
