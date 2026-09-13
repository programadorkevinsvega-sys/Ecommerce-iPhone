import { describe, expect, it } from "vitest";
import {
  normalizeMultiline,
  normalizeSearchQuery,
  normalizeSingleLine,
  safeFormError,
  validateEmail,
  validatePhone,
  validateRating,
} from "./inputValidation";

describe("input validation", () => {
  it("normalizes single-line input without converting user data into HTML", () => {
    expect(normalizeSingleLine("  iPhone   17  ")).toBe("iPhone 17");
    expect(normalizeSingleLine(" <tag> ")).toBe("<tag>");
  });

  it("normalizes multiline text while preserving line boundaries", () => {
    expect(normalizeMultiline("  línea 1\r\n línea 2  ")).toBe("línea 1\n línea 2");
  });

  it("normalizes search queries and caps their length", () => {
    expect(normalizeSearchQuery("  iphone   17  ")).toBe("iphone 17");
    expect(normalizeSearchQuery(" ")).toBeUndefined();
    expect(normalizeSearchQuery("a".repeat(150))?.length).toBe(100);
  });

  it("validates canonical email and phone inputs", () => {
    expect(validateEmail("  Test@Example.COM ")).toBe("test@example.com");
    expect(() => validateEmail("invalid")).toThrow("INVALID_EMAIL");
    expect(validatePhone(" +57 300 123 4567 ")).toBe("+57 300 123 4567");
    expect(() => validatePhone("abc")).toThrow("INVALID_PHONE");
  });

  it("validates review rating bounds", () => {
    expect(validateRating("5")).toBe(5);
    expect(() => validateRating(6)).toThrow("INVALID_RATING");
  });

  it("keeps client error messages generic", () => {
    expect(safeFormError(400, "fallback")).toBe("Revisa los datos ingresados e inténtalo nuevamente.");
    expect(safeFormError(500, "No fue posible completar la operación.")).toBe("No fue posible completar la operación.");
  });
});
