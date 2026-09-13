import { getCloudflareContext } from "@opennextjs/cloudflare";

export type HomeSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  href: string;
  active: boolean;
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
      .map((slide) => ({ ...slide, id: `${row.id}:${slide.id}` }));
  } catch {
    return [];
  }
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
