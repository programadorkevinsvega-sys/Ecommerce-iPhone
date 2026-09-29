import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1SeoRepository } from "../../../modules/seo/infrastructure/D1SeoRepository";
import {
  canonicalUrl,
  contentCanonical,
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
    title: override?.seoTitle ?? input.title,
    ...(override?.seoDescription ?? input.description ? { description: override?.seoDescription ?? input.description } : {}),
    ...(override?.ogImageUrl ?? input.image ? { image: override?.ogImageUrl ?? input.image } : {}),
    path: input.path,
    ...(input.type ? { type: input.type } : {}),
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

export function canonicalForPath(path: string): string {
  return canonicalUrl(path, siteConfig());
}

export function shouldIndexPath(path: string): boolean {
  return isIndexablePath(path);
}
