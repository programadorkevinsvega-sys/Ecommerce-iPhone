import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ProductRepository } from "../../../modules/catalog/infrastructure/D1ProductRepository";
import { D1ProductVariantRepository } from "../../../modules/catalog/infrastructure/D1ProductVariantRepository";
import { SearchProducts, type ProductSearch } from "../../../modules/catalog/application/SearchProducts";
import { GetProductVariants } from "../../../modules/catalog/application/ProductVariants";

export async function catalogRepository(): Promise<D1ProductRepository> {
  const { env } = getCloudflareContext();
  return new D1ProductRepository(env.DB);
}
export async function searchCatalog(criteria: ProductSearch) { return new SearchProducts(await catalogRepository()).execute(criteria); }
export async function getProductBySlug(slug: string) { return (await catalogRepository()).findBySlug(slug); }
export async function getProductVariants(productId:string) { const {env}=getCloudflareContext(); return new GetProductVariants(new D1ProductVariantRepository(env.DB)).execute(productId); }
