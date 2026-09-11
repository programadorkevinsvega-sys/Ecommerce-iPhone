import { describe, expect, it } from "vitest";
import { assertPaymentTransition, canTransitionPayment } from "./Payment";

describe("Payment state machine", () => {
  it("allows pending to paid", () => {
    expect(canTransitionPayment("PENDING", "PAID")).toBe(true);
    expect(() => assertPaymentTransition("PENDING", "PAID")).not.toThrow();
  });

  it("rejects paid back to pending", () => {
    expect(canTransitionPayment("PAID", "PENDING")).toBe(false);
    expect(() => assertPaymentTransition("PAID", "PENDING")).toThrow();
  });

  it("allows refund only from paid", () => {
    expect(canTransitionPayment("PAID", "REFUNDED")).toBe(true);
    expect(canTransitionPayment("FAILED", "REFUNDED")).toBe(false);
  });
});
