import type { MetadataRoute } from "next";
import { searchCatalog } from "../lib/catalog";

export const dynamic = "force-dynamic";
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result = await searchCatalog({ page: 1, pageSize: 48 });
  const products = result.items.map((product) => ({ url: `${baseUrl}/${product.brand.toLowerCase() === "apple" ? "iphone" : "productos"}/${product.slug}`, changeFrequency: "daily" as const, priority: 0.8 }));
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/catalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/iphone`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/servicios`, changeFrequency: "weekly", priority: 0.8 },
    ...products,
  ];
}
