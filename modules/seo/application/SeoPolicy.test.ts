import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SITE_URL,
  canonicalPath,
  canonicalUrl,
  contentCanonical,
  indexability,
  isIndexablePath,
  siteConfig,
} from "./SeoPolicy";

describe("SEO policy", () => {
  it("uses production origin when APP_ENV is production", () => {
    const previous = process.env.APP_ENV;
    const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.APP_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(siteConfig().origin).toBe(PRODUCTION_SITE_URL);
    if (previous === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previous;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  });

  it("ignores nonproduction configured hosts", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.invalid";
    expect(siteConfig().origin).toBe(PRODUCTION_SITE_URL);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });

  it("normalizes public canonical paths", () => {
    expect(canonicalPath("https://iphone.jnmtortas.com/iphone/test/")).toBe("/iphone/test");
    expect(canonicalUrl("/iphone/test")).toBe("https://iphone.jnmtortas.com/iphone/test");
  });

  it("never accepts a foreign canonical origin", () => {
    expect(canonicalUrl("https://evil.example/path")).toBe("https://iphone.jnmtortas.com/path");
    expect(contentCanonical({ path: "/blog/test", storedCanonicalUrl: "https://evil.example/test" })).toEqual({
      canonical: "https://iphone.jnmtortas.com/blog/test",
      noindex: true,
    });
  });

  it("marks missing and explicit noindex content correctly", () => {
    expect(indexability("index", false)).toEqual({ index: false, follow: true });
    expect(indexability("noindex")).toEqual({ index: false, follow: true });
  });

  it("excludes private storefront surfaces from indexing", () => {
    expect(isIndexablePath("/catalog")).toBe(true);
    expect(isIndexablePath("/admin")).toBe(false);
    expect(isIndexablePath("/cuenta/perfil")).toBe(false);
    expect(isIndexablePath("/api/content")).toBe(false);
  });
});
