import { describe, expect, it } from "vitest";
import { Result } from "./Result";

describe("Result", () => {
  it("creates a successful result", () => {
    const result = Result.ok("value");
    expect(result).toEqual({ ok: true, value: "value" });
  });

  it("creates a failed result", () => {
    const error = new Error("failure");
    const result = Result.fail(error);
    expect(result).toEqual({ ok: false, error });
  });
});
