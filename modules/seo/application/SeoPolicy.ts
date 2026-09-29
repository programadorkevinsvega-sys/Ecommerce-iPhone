export const PRODUCTION_SITE_URL = "https://iphone.jnmtortas.com";

export type SeoSiteConfig = Readonly<{
  origin: string;
  name: string;
  locale: string;
}>;

export type Indexability = Readonly<{
  index: boolean;
  follow: boolean;
}>;

export function siteConfig(): SeoSiteConfig {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin =
    configured &&
    (configured === PRODUCTION_SITE_URL ||
      /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/iu.test(configured))
      ? configured.replace(/\/$/, "")
      : PRODUCTION_SITE_URL;

  return { origin, name: "Ecommerce iPhone", locale: "es_CO" };
}

export function canonicalUrl(pathOrUrl: string, config = siteConfig()): string {
  const raw = pathOrUrl.trim();
  const url = new URL(raw, config.origin + "/");
  if (!/^https?:$/iu.test(url.protocol)) return config.origin + "/";

  const configuredOrigin = new URL(config.origin).origin;
  const pathname = normalizePath(url.pathname);
  if (url.origin !== configuredOrigin) return config.origin + pathname;
  return config.origin + pathname + (url.search ? url.search : "");
}

export function canonicalPath(pathOrUrl: string): string {
  const url = new URL(pathOrUrl, "https://seo.invalid/");
  return normalizePath(url.pathname);
}

function normalizePath(pathname: string): string {
  const normalized = "/" + pathname.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (normalized === "/") return "/";
  return normalized.replace(/\/$/, "");
}

export function indexability(
  value: "index" | "noindex" | undefined,
  exists = true,
): Indexability {
  if (!exists || value === "noindex") return { index: false, follow: true };
  return { index: true, follow: true };
}

export function contentCanonical(input: { path: string; storedCanonicalUrl?: string }): {
  canonical: string;
  noindex: boolean;
} {
  const config = siteConfig();
  if (!input.storedCanonicalUrl) {
    return { canonical: canonicalUrl(input.path, config), noindex: false };
  }

  try {
    const stored = new URL(input.storedCanonicalUrl);
    if (stored.origin !== new URL(config.origin).origin) {
      return { canonical: canonicalUrl(input.path, config), noindex: true };
    }
    return { canonical: canonicalUrl(stored.pathname + stored.search, config), noindex: false };
  } catch {
    return { canonical: canonicalUrl(input.path, config), noindex: true };
  }
}

export function isIndexablePath(pathname: string): boolean {
  return ![
    "/admin",
    "/api",
    "/cart",
    "/checkout",
    "/cuenta",
    "/orders",
    "/technician",
  ].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}
