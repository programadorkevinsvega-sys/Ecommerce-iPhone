import { getCloudflareContext } from "@opennextjs/cloudflare";
import { unstable_cache } from "next/cache";
import { CATEGORIES_CACHE_TAG, PublicCategories } from "../../../modules/catalog/application/Categories";
import { D1CategoryRepository } from "../../../modules/catalog/infrastructure/D1CategoryRepository";
import { D1ProductRepository } from "../../../modules/catalog/infrastructure/D1ProductRepository";
import { D1ProductVariantRepository } from "../../../modules/catalog/infrastructure/D1ProductVariantRepository";
import { SearchProducts, type ProductSearch } from "../../../modules/catalog/application/SearchProducts";
import { GetProductVariants } from "../../../modules/catalog/application/ProductVariants";
import { normalizeSearchQuery } from "./inputValidation";

export async function catalogRepository(): Promise<D1ProductRepository> {
  const { env } = await getCloudflareContext({ async: true });
  return new D1ProductRepository(env.DB);
}

export async function categoryRepository(): Promise<D1CategoryRepository> {
  const { env } = await getCloudflareContext({ async: true });
  return new D1CategoryRepository(env.DB);
}

const listCachedPublicCategories = unstable_cache(
  async () => new PublicCategories(await categoryRepository()).list(),
  ["catalog-public-categories"],
  { tags: [CATEGORIES_CACHE_TAG], revalidate: 300 },
);

export async function searchCatalog(criteria: ProductSearch) {
  if (criteria.q === undefined) return new SearchProducts(await catalogRepository()).execute(criteria);
  const normalizedQuery = normalizeSearchQuery(criteria.q);
  const normalized: ProductSearch = normalizedQuery === undefined ? { ...criteria } : { ...criteria, q: normalizedQuery };
  return new SearchProducts(await catalogRepository()).execute(normalized);
}

export async function listPublicCategories() { return listCachedPublicCategories(); }
export async function getPublicCategoryBySlug(slug: string) { return new PublicCategories(await categoryRepository()).findBySlug(slug); }
export async function getProductBySlug(slug: string) { return (await catalogRepository()).findBySlug(slug); }
export async function getProductVariants(productId:string) { const {env}=getCloudflareContext(); return new GetProductVariants(new D1ProductVariantRepository(env.DB)).execute(productId); }
