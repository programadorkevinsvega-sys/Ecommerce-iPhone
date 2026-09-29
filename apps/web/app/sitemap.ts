import type { MetadataRoute } from "next";
import { listPublicCategories, searchCatalog } from "../lib/catalog";
import { publicContent } from "../lib/publicContent";
import { siteConfig, canonicalUrl } from "../../../modules/seo/application/SeoPolicy";

export const dynamic = "force-dynamic";

const MAX_URLS = 50_000;
const PAGE_SIZE = 48;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = siteConfig();
  const entries: MetadataRoute.Sitemap = [
    { url: canonicalUrl("/", config), changeFrequency: "daily", priority: 1 },
    { url: canonicalUrl("/catalog", config), changeFrequency: "daily", priority: 0.9 },
    { url: canonicalUrl("/iphone", config), changeFrequency: "daily", priority: 0.9 },
    { url: canonicalUrl("/servicios", config), changeFrequency: "weekly", priority: 0.8 },
    { url: canonicalUrl("/blog", config), changeFrequency: "weekly", priority: 0.7 },
    { url: canonicalUrl("/faq", config), changeFrequency: "monthly", priority: 0.6 },
  ];

  const first = await searchCatalog({ page: 1, pageSize: PAGE_SIZE });
  for (const product of first.items) {
    entries.push({
      url: canonicalUrl("/iphone/" + product.slug, config),
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  const totalPages = Math.min(Math.ceil(first.total / PAGE_SIZE), Math.floor(MAX_URLS / PAGE_SIZE));
  for (let page = 2; page <= totalPages; page += 1) {
    const result = await searchCatalog({ page, pageSize: PAGE_SIZE });
    for (const product of result.items) {
      if (entries.length >= MAX_URLS) break;
      entries.push({
        url: canonicalUrl("/iphone/" + product.slug, config),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
    if (result.items.length === 0 || entries.length >= MAX_URLS) break;
  }

  const content = await publicContent();
  const [pages, blog, landing] = await Promise.all([
    content.list("page"),
    content.list("blog"),
    content.list("landing"),
  ]);

  for (const item of pages) {
    if (entries.length >= MAX_URLS) break;
    const path = "/content/" + item.slug;
    const canonical = safeCanonical(item.canonicalUrl, config.origin);
    if (item.canonicalUrl && !canonical) continue;
    entries.push({
      url: canonicalUrl(canonical ? canonical.pathname + canonical.search : path, config),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const item of blog) {
    if (entries.length >= MAX_URLS) break;
    const canonical = item.canonicalUrl ? new URL(item.canonicalUrl) : null;
    if (canonical && canonical.origin !== new URL(config.origin).origin) continue;
    entries.push({
      url: canonicalUrl(canonical ? canonical.pathname + canonical.search : "/blog/" + item.slug, config),
      ...(item.publishedAt ? { lastModified: new Date(item.publishedAt) } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const item of landing) {
    if (entries.length >= MAX_URLS) break;
    const canonical = item.canonicalUrl ? new URL(item.canonicalUrl) : null;
    if (canonical && canonical.origin !== new URL(config.origin).origin) continue;
    entries.push({
      url: canonicalUrl(canonical ? canonical.pathname + canonical.search : "/landing/" + item.slug, config),
      ...(item.publishedAt ? { lastModified: new Date(item.publishedAt) } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
