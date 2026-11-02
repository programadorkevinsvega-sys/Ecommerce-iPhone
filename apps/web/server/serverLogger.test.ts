import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError, logServerMetric } from "./serverLogger";

describe("structured server logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits JSON context while redacting credentials and personal/payment data", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logServerError(
      "payment.refund",
      new Error(
        "Provider rejected Bearer sk_live_secret_123 for buyer@example.com card 4111 1111 1111 1111 +573001234567",
      ),
      {
        component: "payments",
        requestId: "req_pr26_trace_0001",
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
      source: string;
      operation: string;
      requestId: string;
      authorization: string;
      sessionCookie: string;
      customerEmail: string;
      accountId: string;
      error: { name: string; message: string; stack?: string };
    };
    expect(record.level).toBe("error");
    expect(record.source).toBe("server");
    expect(record.operation).toBe("payment.refund");
    expect(record.requestId).toBe("req_pr26_trace_0001");
    expect(record.authorization).toBe("[REDACTED]");
    expect(record.sessionCookie).toBe("[REDACTED]");
    expect(record.customerEmail).toBe("[REDACTED]");
    expect(record.accountId).toBe("[REDACTED]");
    expect(record.error.message).toContain("Bearer [REDACTED]");
    expect(record.error.message).toContain("[REDACTED_EMAIL]");
    expect(record.error.message).toContain("[REDACTED_CARD]");
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

  it("redacts secret-like values embedded in context strings", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logServerError("queue.retry", "token=queue-secret-value", { queueName: "events" });
    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("queue-secret-value");
    expect(serialized).toContain("token=[REDACTED]");
  });
  
  it("emits structured request metrics without retaining arbitrary identifiers or secrets", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logServerMetric("http.request", {
      component: "cloudflare-worker",
      method: "GET",
      route: "/api/orders",
      status: 500,
      durationMs: 42,
      requestId: "req_metric_123456",
      authorization: "Bearer metric-secret",
    });
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
