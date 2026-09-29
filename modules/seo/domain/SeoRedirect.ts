export type SeoRedirectStatus = 301 | 410;

export type SeoRedirectProps = Readonly<{
  id: string;
  sourcePath: string;
  targetUrl?: string;
  statusCode: SeoRedirectStatus;
  active: boolean;
  createdByAdminId: string;
  updatedByAdminId: string;
}>;

export function validateSeoRedirect(input: Readonly<{
  sourcePath: string;
  targetUrl?: string;
  statusCode: number;
}>): void {
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(input.sourcePath) || input.sourcePath.includes("..")) {
    throw new Error("INVALID_SEO_REDIRECT_SOURCE");
  }
  if (input.sourcePath.length > 2048) throw new Error("INVALID_SEO_REDIRECT_SOURCE");
  if (input.statusCode !== 301 && input.statusCode !== 410) {
    throw new Error("INVALID_SEO_REDIRECT_STATUS");
  }
  if (input.statusCode === 301) {
    if (!input.targetUrl) throw new Error("SEO_REDIRECT_TARGET_REQUIRED");
    const target = new URL(input.targetUrl, "https://iphone.jnmtortas.com/");
    if (target.origin !== "https://iphone.jnmtortas.com" || target.pathname === input.sourcePath) {
      throw new Error("INVALID_SEO_REDIRECT_TARGET");
    }
  } else if (input.targetUrl !== undefined) {
    throw new Error("SEO_GONE_TARGET_FORBIDDEN");
  }
}

export function validateSeoRoutePath(path: string): void {
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*$/.test(path) || path.includes("..") || path.length > 2048) {
    throw new Error("INVALID_SEO_ROUTE");
  }
}

export function validateSeoRouteOverride(input: Readonly<{
  path: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
}>): void {
  validateSeoRoutePath(input.path);
  if (input.seoTitle !== undefined && (!input.seoTitle.trim() || input.seoTitle.length > 180)) {
    throw new Error("INVALID_SEO_TITLE");
  }
  if (input.seoDescription !== undefined && input.seoDescription.length > 320) {
    throw new Error("INVALID_SEO_DESCRIPTION");
  }
  for (const [field, value] of [
    ["canonicalUrl", input.canonicalUrl],
    ["ogImageUrl", input.ogImageUrl],
  ] as const) {
    if (value === undefined) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("INVALID_" + field.toUpperCase());
    }
    if (url.origin !== "https://iphone.jnmtortas.com" || url.protocol !== "https:") {
      throw new Error("INVALID_" + field.toUpperCase());
    }
  }
}
