import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logServerDebug,
  logServerError,
  logServerInfo,
  logServerMetric,
  logServerWarn,
} from "./serverLogger";

describe("structured server logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("emits a stable JSON envelope while redacting credentials and personal/payment data", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logServerError(
      "payment.refund",
      new Error(
        "Provider rejected Bearer sk_live_secret_123 for buyer@example.com card 4111 1111 1111 1111 +573001234567",
      ),
      {
        component: "payments",
        environment: "production",
        requestId: "req_pr26_trace_0001",
        correlationId: "order:trace-0001",
        authorization: "Bearer sk_live_secret_123",
        sessionCookie: "session-secret-value",
        customerEmail: "buyer@example.com",
        accountId: "acct-private-123456789",
      },
    );
    expect(output).toHaveBeenCalledTimes(1);
    const record = JSON.parse(String(output.mock.calls[0]?.[0])) as {
      timestamp: string;
      level: string;
      service: string;
      environment: string;
      source: string;
      operation: string;
      requestId: string;
      correlationId: string;
      authorization: string;
      sessionCookie: string;
      customerEmail: string;
      accountId: string;
      error: { name: string; message: string; stack?: string };
    };
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect(record.level).toBe("error");
    expect(record.service).toBe("ecommerce-iphone-web");
    expect(record.environment).toBe("production");
    expect(record.source).toBe("server");
    expect(record.operation).toBe("payment.refund");
    expect(record.requestId).toBe("req_pr26_trace_0001");
    expect(record.correlationId).toBe("order:trace-0001");
    expect(record.authorization).toBe("[REDACTED]");
    expect(record.sessionCookie).toBe("[REDACTED]");
    expect(record.customerEmail).toBe("[REDACTED]");
    expect(record.accountId).toBe("[REDACTED]");
    expect(record.error.message).toContain("Bearer [REDACTED]");
    expect(record.error.message).toContain("[REDACTED_EMAIL]");
    expect(record.error.message).toContain("[REDACTED_CARD_OR_DEVICE_ID]");
    expect(record.error.message).toContain("[REDACTED_PHONE]");
    expect(record.error.stack).toBeUndefined();
    const serialized = JSON.stringify(record);
    for (const secret of [
      "sk_live_secret_123",
      "session-secret-value",
      "buyer@example.com",
      "4111 1111 1111 1111",
      "+573001234567",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("redacts IMEI and serial values in free-text error messages", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logServerError(
      "device.diagnostic",
      new Error("Rejected imei=356938035643809 serialNumber=ABC123456789"),
    );
    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).toContain("imei=[REDACTED_IMEI]");
    expect(serialized).toContain("serialNumber=[REDACTED_SERIAL]");
    expect(serialized).not.toContain("356938035643809");
    expect(serialized).not.toContain("ABC123456789");
  });

  it("redacts secret-like values embedded in context strings", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logServerError("queue.retry", "token=queue-secret-value", { queueName: "events" });
    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("queue-secret-value");
    expect(serialized).toContain("token=[REDACTED]");
  });

  it("normalizes structured context and rejects unsafe trace, route, duration and status values", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logServerInfo("http.request", {
      environment: "preview",
      requestId: "valid-request-123",
      correlationId: "order:123",
      route: "/api/orders/123?customerEmail=private@example.com",
      durationMs: 12.345,
      status: 201,
      errorCode: "ORDER_CREATED",
      authorization: "Bearer metric-secret",
      invalidTrace: "bad\nrequest-id",
      debugEnabled: false,
    });
    const record = JSON.parse(String(output.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record.level).toBe("info");
    expect(record.service).toBe("ecommerce-iphone-web");
    expect(record.environment).toBe("preview");
    expect(record.requestId).toBe("valid-request-123");
    expect(record.correlationId).toBe("order:123");
    expect(record.route).toBe("/api/orders/123");
    expect(record.durationMs).toBe(12.35);
    expect(record.status).toBe(201);
    expect(record.errorCode).toBe("ORDER_CREATED");
    expect(record.authorization).toBe("[REDACTED]");
    expect(record.invalidTrace).toBe("bad request-id");
    expect(JSON.stringify(record)).not.toContain("metric-secret");
  });

  it("derives only a stable code from typed errors", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("payment provider failed"), {
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
    });
    logServerError("payment.intent", error);
    const record = JSON.parse(String(output.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record.errorCode).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
  });

  it("supports all normalized log levels and keeps debug opt-in", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerDebug("debug.disabled");
    expect(debug).not.toHaveBeenCalled();

    vi.stubEnv("APP_LOG_LEVEL", "debug");
    logServerDebug("debug.enabled", { requestId: "req-debug-123" });
    logServerInfo("operation.completed");
    logServerWarn("provider.degraded", new Error("temporary outage"));
    logServerError("operation.failed", new Error("unexpected"));

    expect(debug).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);

    const debugRecord = JSON.parse(String(debug.mock.calls[0]?.[0])) as Record<string, unknown>;
    const warnRecord = JSON.parse(String(warn.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(debugRecord.level).toBe("debug");
    expect(warnRecord.level).toBe("warn");
  });

  it("emits operational metric records as one JSON info event", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logServerMetric("http.request", {
      component: "cloudflare-worker",
      environment: "production",
      method: "GET",
      route: "/api/orders",
      status: 500,
      durationMs: 42,
      requestId: "req_metric_123456",
      authorization: "Bearer metric-secret",
    });
    expect(output).toHaveBeenCalledTimes(1);
    const record = JSON.parse(String(output.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record.level).toBe("info");
    expect(record.source).toBe("operational_metric");
    expect(record.operation).toBe("http.request");
    expect(record.route).toBe("/api/orders");
    expect(record.status).toBe(500);
    expect(record.durationMs).toBe(42);
    expect(record.authorization).toBe("[REDACTED]");
    expect(JSON.stringify(record)).not.toContain("metric-secret");
  });
});
