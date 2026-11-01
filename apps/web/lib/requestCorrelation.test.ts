import { describe, expect, it } from "vitest";
import { isValidRequestId, resolveRequestId } from "./requestCorrelation";

describe("request correlation", () => {
  it("reuses a valid request ID from the incoming request", () => {
    const headers = new Headers({ "x-request-id": "req_pr26_trace_0001" });
    expect(resolveRequestId(headers)).toBe("req_pr26_trace_0001");
  });

  it("rejects malformed IDs and creates a UUID instead", () => {
    const headers = new Headers({ "x-request-id": "invalid request id" });
    const id = resolveRequestId(headers);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(isValidRequestId("invalid request id")).toBe(false);
  });

  it("accepts only bounded, header-safe request IDs", () => {
    expect(isValidRequestId("req_12345678")).toBe(true);
    expect(isValidRequestId("short")).toBe(false);
    expect(isValidRequestId("x".repeat(129))).toBe(false);
    expect(isValidRequestId("bad\nvalue")).toBe(false);
  });
});
