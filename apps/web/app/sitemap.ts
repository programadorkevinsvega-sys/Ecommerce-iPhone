import type { MetadataRoute } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { searchCatalog } from "../lib/catalog";
import { publicContent } from "../lib/publicContent";
import { siteConfig, canonicalUrl } from "../../../modules/seo/application/SeoPolicy";
import { seoManagementApplication } from "../lib/seoApplication";

export const dynamic = "force-dynamic";

const MAX_URLS = 50_000;
const PAGE_SIZE = 48;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = siteConfig();
  const { env } = await getCloudflareContext({ async: true });
  const overrides = new Map((await seoManagementApplication(env).routeOverrides()).map((item) => [item.path, item]));
  const entries: MetadataRoute.Sitemap = [
    { url: canonicalUrl("/", config), changeFrequency: "daily", priority: 1 },
    { url: canonicalUrl("/catalog", config), changeFrequency: "daily", priority: 0.9 },
    { url: canonicalUrl("/iphone", config), changeFrequency: "daily", priority: 0.9 },
    { url: canonicalUrl("/servicios", config), changeFrequency: "weekly", priority: 0.8 },
    { url: canonicalUrl("/blog", config), changeFrequency: "weekly", priority: 0.7 },
    { url: canonicalUrl("/faq", config), changeFrequency: "monthly", priority: 0.6 },
    { url: canonicalUrl("/contacto", config), changeFrequency: "monthly", priority: 0.5 },
    { url: canonicalUrl("/reparaciones", config), changeFrequency: "weekly", priority: 0.7 },
  ];

  const addEntry = (path: string, defaults: Omit<MetadataRoute.Sitemap[number], "url">) => {
    const override = overrides.get(path);
    if (override && !override.indexable) return;
    let url = canonicalUrl(path, config);
    if (override?.canonicalUrl) {
      try {
        const canonical = new URL(override.canonicalUrl);
        if (canonical.origin !== new URL(config.origin).origin) return;
        url = canonicalUrl(canonical.pathname + canonical.search, config);
      } catch {
        return;
      }
    }
    entries.push({ url, ...defaults });
  };

  const brands = new Set<string>();
  const first = await searchCatalog({ page: 1, pageSize: PAGE_SIZE });
  for (const product of first.items) {
    brands.add(product.brand);
    addEntry("/iphone/" + product.slug, { changeFrequency: "daily", priority: 0.8 });
  }

  const totalPages = Math.min(Math.ceil(first.total / PAGE_SIZE), Math.floor(MAX_URLS / PAGE_SIZE));
  for (let page = 2; page <= totalPages; page += 1) {
    const result = await searchCatalog({ page, pageSize: PAGE_SIZE });
    for (const product of result.items) {
      brands.add(product.brand);
      if (entries.length >= MAX_URLS) break;
      addEntry("/iphone/" + product.slug, { changeFrequency: "daily", priority: 0.8 });
    }
    if (result.items.length === 0 || entries.length >= MAX_URLS) break;
  }

  for (const brand of brands) {
    if (entries.length >= MAX_URLS) break;
    const slug = brand.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) continue;
    addEntry("/catalog/" + slug, { changeFrequency: "daily", priority: 0.7 });
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
    addEntry(canonical ? canonical.pathname + canonical.search : path, { changeFrequency: "weekly", priority: 0.6 });
  }

  for (const item of blog) {
    if (entries.length >= MAX_URLS) break;
    const canonical = safeCanonical(item.canonicalUrl, config.origin);
    if (item.canonicalUrl && !canonical) continue;
    addEntry(canonical ? canonical.pathname + canonical.search : "/blog/" + item.slug, {
      ...(item.publishedAt ? { lastModified: new Date(item.publishedAt) } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const item of landing) {
    if (entries.length >= MAX_URLS) break;
    const canonical = item.canonicalUrl ? new URL(item.canonicalUrl) : null;
    if (canonical && canonical.origin !== new URL(config.origin).origin) continue;
    addEntry(canonical ? canonical.pathname + canonical.search : "/landing/" + item.slug, {
      ...(item.publishedAt ? { lastModified: new Date(item.publishedAt) } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}

function safeCanonical(value: string | undefined, origin: string): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === new URL(origin).origin ? url : null;
  } catch {
    return null;
  }
}
