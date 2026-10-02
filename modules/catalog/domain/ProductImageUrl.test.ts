import { describe, expect, it } from "vitest";
import {
  isProductImageProxyUrl,
  isTrustedExternalImageUrl,
  normalizeProductImageUrl,
  toProductImageProxyUrl,
} from "./ProductImageUrl";

describe("ProductImageUrl", () => {
  const trusted = "https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro_Max.jpg";

  it("allows only HTTPS trusted image hosts", () => {
    expect(isTrustedExternalImageUrl(trusted)).toBe(true);
    expect(isTrustedExternalImageUrl("http://commons.wikimedia.org/image.jpg")).toBe(false);
    expect(isTrustedExternalImageUrl("https://attacker.example/image.jpg")).toBe(false);
    expect(isTrustedExternalImageUrl("https://commons.wikimedia.org:444/image.jpg")).toBe(false);
  });

  it("builds and validates the internal proxy representation", () => {
    const proxy = toProductImageProxyUrl(trusted);
    expect(proxy).toBe(`/api/media/proxy?url=${encodeURIComponent(trusted)}`);
    expect(isProductImageProxyUrl(proxy)).toBe(true);
    expect(normalizeProductImageUrl(proxy)).toBe(proxy);
  });

  it("rejects proxy URLs with untrusted or duplicated targets", () => {
    const attacker = `/api/media/proxy?url=${encodeURIComponent("https://attacker.example/image.jpg")}`;
    const duplicate = `/api/media/proxy?url=${encodeURIComponent(trusted)}&url=${encodeURIComponent(trusted)}`;
    expect(isProductImageProxyUrl(attacker)).toBe(false);
    expect(isProductImageProxyUrl(duplicate)).toBe(false);
    expect(() => normalizeProductImageUrl(attacker)).toThrow();
  });

  it("rejects direct external URLs at the domain boundary", () => {
    expect(() => normalizeProductImageUrl(trusted)).toThrow();
  });
});
