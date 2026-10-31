import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, SECURITY_RESPONSE_HEADERS } from "./securityHeaders";

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

  it("keeps CSP same-origin by default and denies framing and plugin content", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(CONTENT_SECURITY_POLICY).not.toContain("*");
    expect(CONTENT_SECURITY_POLICY.split("https://").length - 1).toBe(1);
    expect(CONTENT_SECURITY_POLICY).toContain("https://static.cloudflareinsights.com");
  });
});
