export const ANALYTICS_VISITOR_COOKIE = "__Host-analytics-visitor";
export const ANALYTICS_SESSION_COOKIE = "__Host-analytics-session";

const ANALYTICS_ID = /^[A-Za-z0-9._:-]{8,128}$/;

function cookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name) continue;
    const value = rawValue.join("=").trim();
    return ANALYTICS_ID.test(value) ? value : undefined;
  }
  return undefined;
}

export function analyticsRequestContext(request: Request): {
  visitorId: string | undefined;
  sessionId: string | undefined;
} {
  return {
    visitorId: cookieValue(request.headers.get("cookie"), ANALYTICS_VISITOR_COOKIE),
    sessionId: cookieValue(request.headers.get("cookie"), ANALYTICS_SESSION_COOKIE),
  };
}

export function analyticsSetCookie(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${value}`,
    "Path=/",
    "Max-Age=" + maxAge,
    "Secure",
    "HttpOnly",
    "SameSite=Lax",
  ].join("; ");
}
