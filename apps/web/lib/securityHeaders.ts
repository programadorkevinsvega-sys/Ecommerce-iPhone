export function buildContentSecurityPolicy(nonce?: string): string {
  const scriptSources = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    "https://static.cloudflareinsights.com",
  ];
  const styleSources = ["'self'", ...(nonce ? [`'nonce-${nonce}'`] : [])];
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src ${styleSources.join(" ")}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

export const SECURITY_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};
