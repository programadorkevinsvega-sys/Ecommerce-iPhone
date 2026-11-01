import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  CONTENT_SECURITY_POLICY,
  SECURITY_RESPONSE_HEADERS,
} from "./securityHeaders";

describe("security response headers", () => {
  it("defines baseline browser protections", () => {
    expect(SECURITY_RESPONSE_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_RESPONSE_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_RESPONSE_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_RESPONSE_HEADERS["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(SECURITY_RESPONSE_HEADERS["Strict-Transport-Security"]).toContain("max-age=31536000");
  });

  it("restricts scripts to same-origin, a per-request nonce and the explicit Insights host", () => {
    const scriptSrc = CONTENT_SECURITY_POLICY.split(";").find((value) =>
      value.trim().startsWith("script-src "),
    );
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("https://static.cloudflareinsights.com");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("restricts styles to same-origin and the per-request nonce", () => {
    const styleSrc = buildContentSecurityPolicy("test-nonce")
      .split(";")
      .find((value) => value.trim().startsWith("style-src "));
    expect(styleSrc).toContain("'self'");
    expect(styleSrc).toContain("'nonce-test-nonce'");
    expect(styleSrc).not.toContain("unsafe-inline");
    const styleAttr = buildContentSecurityPolicy("test-nonce")
      .split(";")
      .find((value) => value.trim().startsWith("style-src-attr "));
    expect(styleAttr).toContain("'unsafe-hashes'");
    expect(styleAttr).toContain(
      "'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
    );
    expect(styleAttr).not.toContain("unsafe-inline");
  });

  it("sets no inline allowances in static fallback or nonce policies", () => {
    for (const policy of [CONTENT_SECURITY_POLICY, buildContentSecurityPolicy("nonce-value")]) {
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("object-src 'none'");
      expect(policy).not.toContain("unsafe-inline");
      expect(policy).not.toContain("unsafe-eval");
    }
  });
});
