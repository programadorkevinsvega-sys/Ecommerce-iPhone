import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ProductRepository } from "../../../modules/catalog/infrastructure/D1ProductRepository";
import { SearchProducts, type ProductSearch } from "../../../modules/catalog/application/SearchProducts";

export async function catalogRepository(): Promise<D1ProductRepository> {
  const { env } = getCloudflareContext();
  return new D1ProductRepository(env.DB);
}

export async function searchCatalog(criteria: ProductSearch) {
  const repository = await catalogRepository();
  return new SearchProducts(repository).execute(criteria);
}

export async function getProductBySlug(slug: string) {
  const repository = await catalogRepository();
  return repository.findBySlug(slug);
}
