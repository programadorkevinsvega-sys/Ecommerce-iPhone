import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1SeoRepository } from "../../../modules/seo/infrastructure/D1SeoRepository";
import {
  canonicalUrl,
  indexability,
  isIndexablePath,
  siteConfig,
} from "../../../modules/seo/application/SeoPolicy";

async function getRouteOverride(path: string) {
  const cached = unstable_cache(
    async () => {
      const { env } = await getCloudflareContext({ async: true });
      return new D1SeoRepository(env.DB).findRouteOverride(path);
    },
    ["seo-route-override", path],
    { revalidate: 60, tags: ["seo-route-override", "seo-route-override:" + path] },
  );
  return cached();
}

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
  return {
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
}

export async function publicMetadataWithOverrides(input: {
  title: string;
  description?: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  canonical?: string;
}): Promise<Metadata> {
  const override = await getRouteOverride(input.path);
  const metadata = publicMetadata({
    ...input,
    title: override?.seoTitle ?? input.title,
    description: override?.seoDescription ?? input.description,
    image: override?.ogImageUrl ?? input.image,
    noindex: input.noindex || override?.indexable === false,
  });
  const selectedCanonical = override?.canonicalUrl ?? input.canonical;
  if (!selectedCanonical) return metadata;
  const safe = new URL(selectedCanonical);
  const config = siteConfig();
  if (safe.origin !== new URL(config.origin).origin) {
    return { ...metadata, robots: { index: false, follow: true } };
  }
  return {
    ...metadata,
    alternates: { canonical: canonicalUrl(safe.pathname + safe.search, config) },
  };
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

export function canonicalForPath(path: string): string {
  return canonicalUrl(path, siteConfig());
}

export function shouldIndexPath(path: string): boolean {
  return isIndexablePath(path);
}
