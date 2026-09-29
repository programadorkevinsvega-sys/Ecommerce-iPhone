import type { Metadata } from "next";
import {
  canonicalUrl,
  indexability,
  isIndexablePath,
  siteConfig,
} from "../../../modules/seo/application/SeoPolicy";

export function publicMetadata(input: {
  title: string;
  description?: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
}): Metadata {
  const config = siteConfig();
  const canonical = canonicalUrl(input.path, config);
  const policy = indexability(input.noindex ? "noindex" : "index");
  const metadata: Metadata = {
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    alternates: { canonical },
    robots: { index: policy.index, follow: policy.follow },
    openGraph: {
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      url: canonical,
      type: input.type ?? "website",
      siteName: config.name,
      locale: config.locale,
      ...(input.image
        ? { images: [{ url: canonicalUrl(input.image, config), alt: input.title }] }
        : {}),
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.image ? { images: [canonicalUrl(input.image, config)] } : {}),
    },
  };
  return metadata;
}

export function canonicalForPath(path: string): string {
  return canonicalUrl(path, siteConfig());
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

export function shouldIndexPath(path: string): boolean {
  return isIndexablePath(path);
}
