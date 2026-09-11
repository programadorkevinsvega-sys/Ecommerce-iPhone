import { describe, expect, it } from "vitest";
import { assertPaymentTransition, canTransitionPayment } from "./Payment";

describe("Payment state machine", () => {
  it("allows the valid payment lifecycle", () => {
    expect(canTransitionPayment("CREATED", "PENDING")).toBe(true);
    expect(canTransitionPayment("PENDING", "PROCESSING")).toBe(true);
    expect(canTransitionPayment("PROCESSING", "PAID")).toBe(true);
    expect(canTransitionPayment("PAID", "REFUNDED")).toBe(true);
  });

  it("rejects backward and cross-terminal transitions", () => {
    expect(canTransitionPayment("PAID", "PENDING")).toBe(false);
    expect(canTransitionPayment("PAID", "FAILED")).toBe(false);
    expect(canTransitionPayment("FAILED", "PAID")).toBe(false);
    expect(canTransitionPayment("REFUNDED", "PAID")).toBe(false);
  });

  it("throws on invalid transitions", () => {
    expect(() => assertPaymentTransition("PAID", "CANCELLED")).toThrow("Invalid payment transition");
    expect(() => assertPaymentTransition("FAILED", "REFUNDED")).toThrow("Invalid payment transition");
  });
});
