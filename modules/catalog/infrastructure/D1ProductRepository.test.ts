import { describe, expect, it } from "vitest";
import { normalizeInfrastructureImageUrl } from "./D1ProductRepository";

describe("normalizeInfrastructureImageUrl", () => {
  const trusted = "https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro_Max.jpg";

  it("normalizes trusted external images through the internal proxy", () => {
    expect(normalizeInfrastructureImageUrl(trusted)).toBe(
      `/api/media/proxy?url=${encodeURIComponent(trusted)}`,
    );
  });

  it("preserves valid local product image paths", () => {
    expect(normalizeInfrastructureImageUrl("/products/iphone.jpg")).toBe("/products/iphone.jpg");
    expect(normalizeInfrastructureImageUrl("/api/media/product-images/product-1.webp")).toBe(
      "/api/media/product-images/product-1.webp",
    );
  });

  it("omits malformed or untrusted external sources", () => {
    expect(normalizeInfrastructureImageUrl("https://attacker.example/image.jpg")).toBeUndefined();
    expect(normalizeInfrastructureImageUrl("not-a-url")).toBeUndefined();
    expect(normalizeInfrastructureImageUrl("")).toBeUndefined();
  });
});
