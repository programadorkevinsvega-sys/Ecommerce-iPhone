import { getCloudflareContext } from "@opennextjs/cloudflare";
import { searchCatalog } from "./catalog";

export type HomeSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  href: string;
  active: boolean;
};
export type HomeCollectionItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  imageUrl?: string;
};

export async function listPublicHomeSlides(): Promise<HomeSlide[]> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    "SELECT id, content FROM cms_pages WHERE slug = ? AND active = 1 LIMIT 1",
  )
    .bind("home-carousel")
    .first<{ id: string; content: string }>();
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.content) as { slides?: unknown };
    if (!Array.isArray(parsed.slides)) return [];
    return parsed.slides
      .filter(isHomeSlide)
      .filter((slide) => slide.active)
      .map((slide) => ({
        ...slide,
        imageUrl: publicImageUrl(slide.imageUrl),
        id: `${row.id}:${slide.id}`,
      }));
  } catch {
    return [];
  }
}

export async function listHomeProductItems(): Promise<HomeCollectionItem[]> {
  const result = await searchCatalog({ page: 1, pageSize: 12, sort: "newest" });
  return result.items.map((product) => ({
    id: product.id,
    eyebrow: product.brand,
    title: product.name,
    description: product.description,
    href: `/iphone/${product.slug}`,
    ...(product.images[0] ? { imageUrl: product.images[0] } : {}),
  }));
}

export async function listHomeServiceItems(): Promise<HomeCollectionItem[]> {
  const { env } = await getCloudflareContext({ async: true });
  const rows = await env.DB.prepare(
    "SELECT code,name,description,category FROM service_types WHERE enabled=1 ORDER BY sort_order ASC,name ASC LIMIT 12",
  ).all<{ code: string; name: string; description: string; category: string }>();
  return rows.results.map((service) => ({
    id: service.code,
    eyebrow: service.category,
    title: service.name,
    description: service.description,
    href: `/servicios/solicitar?type=${encodeURIComponent(service.code)}`,
  }));
}

function publicImageUrl(url: string) {
  if (url.startsWith("/")) return url;
  return `/api/media/proxy?url=${encodeURIComponent(url)}`;
}

function isHomeSlide(value: unknown): value is Omit<HomeSlide, "id"> & { id: string } {
  if (!value || typeof value !== "object") return false;
  const slide = value as Record<string, unknown>;
  return (
    ["id", "eyebrow", "title", "description", "imageUrl", "href"].every(
      (key) => typeof slide[key] === "string" && Boolean(slide[key]),
    ) &&
    (slide.active === undefined || typeof slide.active === "boolean")
  );
}
