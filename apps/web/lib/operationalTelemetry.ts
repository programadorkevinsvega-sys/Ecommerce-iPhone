const SENSITIVE_RATE_LIMIT_PREFIXES = [
  "/api/checkout",
  "/api/customer",
  "/api/admin",
  "/api/services",
  "/api/auth",
  "/api/payments",
  "/api/notifications",
  "/api/observability",
] as const;

const API_ROUTE_GROUPS = new Set([
  "admin",
  "analytics",
  "auth",
  "cart",
  "categories",
  "checkout",
  "content",
  "customer",
  "health",
  "media",
  "notifications",
  "orders",
  "payments",
  "products",
  "reviews",
  "search",
  "services",
  "technicians",
  "webhooks",
]);

const PAGE_ROUTE_GROUPS = new Set([
  "account",
  "admin",
  "blog",
  "cart",
  "catalog",
  "checkout",
  "contact",
  "faq",
  "iphone",
  "login",
  "orders",
  "register",
  "services",
  "technician",
]);

export type RateLimitTier = "none" | "api" | "sensitive";

/** Keep rate-limit classification explicit and testable; health probes never consume API quota. */
export function classifyRateLimitPath(pathname: string): RateLimitTier {
  if (!pathname.startsWith("/api/")) return "none";
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) return "none";

  const isSensitive = SENSITIVE_RATE_LIMIT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return isSensitive ? "sensitive" : "api";
}

/**
 * Produce low-cardinality route labels for logs and metrics.
 * Never include IDs, slugs, query strings, or arbitrary path segments.
 */
export function normalizeOperationalRoute(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";

  if (segments[0] === "api") {
    const group = segments[1]?.toLowerCase() ?? "";
    return API_ROUTE_GROUPS.has(group) ? `/api/${group}` : "/api/other";
  }

  const group = segments[0]?.toLowerCase() ?? "";
  return PAGE_ROUTE_GROUPS.has(group) ? `/${group}` : "/other";
}
