import { describe, expect, it } from "vitest";
import { normalizeProductImageInput } from "./ProductImagePolicy";
import { toProductImageProxyUrl } from "../domain/ProductImageUrl";

describe("ProductImagePolicy", () => {
  const trusted =
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro_Max.jpg";

  it("normalizes trusted external inputs to the internal proxy", () => {
    expect(normalizeProductImageInput(trusted)).toBe(toProductImageProxyUrl(trusted));
  });

  it("rejects untrusted external inputs", () => {
    expect(normalizeProductImageInput("https://attacker.example/image.jpg")).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(normalizeProductImageInput("   ")).toBeUndefined();
  });
});
