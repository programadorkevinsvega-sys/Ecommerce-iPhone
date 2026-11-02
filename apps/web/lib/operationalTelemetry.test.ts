import { describe, expect, it } from "vitest";
import { classifyRateLimitPath, normalizeOperationalRoute } from "./operationalTelemetry";

describe("operational route and rate-limit classification", () => {
  it("keeps health endpoints out of API rate limiting without matching similarly named routes", () => {
    expect(classifyRateLimitPath("/api/health/live")).toBe("none");
    expect(classifyRateLimitPath("/api/health/ready")).toBe("none");
    expect(classifyRateLimitPath("/api/healthx")).toBe("api");
  });

  it("classifies sensitive API routes on exact path boundaries", () => {
    expect(classifyRateLimitPath("/api/admin")).toBe("sensitive");
    expect(classifyRateLimitPath("/api/admin/users/123")).toBe("sensitive");
    expect(classifyRateLimitPath("/api/checkout")).toBe("sensitive");
    expect(classifyRateLimitPath("/api/observability/client-error")).toBe("sensitive");
    expect(classifyRateLimitPath("/api/administer")).toBe("api");
    expect(classifyRateLimitPath("/api/catalog")).toBe("api");
    expect(classifyRateLimitPath("/catalog")).toBe("none");
  });

  it("normalizes routes without retaining customer, product or resource identifiers", () => {
    expect(normalizeOperationalRoute("/api/orders/customer-email@example.com")).toBe("/api/orders");
    expect(normalizeOperationalRoute("/api/admin/users/private-id-123/refunds")).toBe("/api/admin");
    expect(normalizeOperationalRoute("/iphone/iphone-18-pro-max")).toBe("/iphone");
    expect(normalizeOperationalRoute("/customers/person@example.com")).toBe("/other");
    expect(normalizeOperationalRoute("/")).toBe("/");
  });
});
