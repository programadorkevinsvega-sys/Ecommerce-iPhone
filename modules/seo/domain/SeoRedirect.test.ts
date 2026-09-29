import { describe, expect, it } from "vitest";
import { validateSeoRedirect, validateSeoRouteOverride } from "./SeoRedirect";

describe("SEO administration domain", () => {
  it("accepts same-origin permanent redirects", () => {
    expect(() =>
      validateSeoRedirect({
        sourcePath: "/old-product",
        targetUrl: "https://iphone.jnmtortas.com/iphone/new-product",
        statusCode: 301,
      }),
    ).not.toThrow();
  });

  it("accepts 410 without a target", () => {
    expect(() =>
      validateSeoRedirect({
        sourcePath: "/removed-product",
        statusCode: 410,
      }),
    ).not.toThrow();
  });

  it("rejects foreign redirect targets", () => {
    expect(() =>
      validateSeoRedirect({
        sourcePath: "/old",
        targetUrl: "https://evil.example/new",
        statusCode: 301,
      }),
    ).toThrow("INVALID_SEO_REDIRECT_TARGET");
  });

  it("rejects invalid SEO override origins", () => {
    expect(() =>
      validateSeoRouteOverride({
        path: "/catalog",
        canonicalUrl: "https://evil.example/catalog",
      }),
    ).toThrow("INVALID_CANONICALURL");
  });
});
