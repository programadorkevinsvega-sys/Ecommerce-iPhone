import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./jsonLd";

describe("serializeJsonLd", () => {
  it("prevents a string from terminating the script context", () => {
    const serialized = serializeJsonLd({
      description: "</script><script>alert('xss')</script>",
      ampersand: "&",
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script");
    expect(serialized).toContain("\\u003C/script\\u003E");
    expect(serialized).toContain("\\u0026");
    expect(JSON.parse(serialized)).toEqual({
      description: "</script><script>alert('xss')</script>",
      ampersand: "&",
    });
  });

  it("escapes Unicode line separators used in JavaScript source contexts", () => {
    const serialized = serializeJsonLd({ value: "\u2028\u2029" });

    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
    expect(JSON.parse(serialized)).toEqual({ value: "\u2028\u2029" });
  });

  it("rejects values that JSON.stringify cannot serialize", () => {
    expect(() => serializeJsonLd(undefined)).toThrow(TypeError);
  });
});
