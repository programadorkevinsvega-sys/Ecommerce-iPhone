import type { ProductSearch, ProductSearchRepository, ProductSearchResult } from "../application/SearchProducts";
import type { Product } from "../domain/Product";
import type { ProductId } from "../domain/ProductId";

export class InMemoryProductRepository implements ProductSearchRepository {
  private readonly items = new Map<string, Product>();
  async findById(id: ProductId): Promise<Product | null> { return this.items.get(id.value) ?? null; }
  async save(product: Product): Promise<void> { this.items.set(product.getId(), product); }
  async search(criteria: ProductSearch): Promise<ProductSearchResult> {
    const q = criteria.q?.trim().toLowerCase(); const page = Math.max(1, criteria.page ?? 1); const pageSize = Math.min(100, Math.max(1, criteria.pageSize ?? 24));
    const filtered = [...this.items.values()].map((p) => p.toPrimitives()).filter((p) => p.active)
      .filter((p) => !q || `${p.name} ${p.brand} ${p.model}`.toLowerCase().includes(q))
      .filter((p) => !criteria.brand || p.brand.toLowerCase() === criteria.brand.toLowerCase())
      .filter(() => !criteria.category)
      .filter((p) => !criteria.model || p.model.toLowerCase().includes(criteria.model.toLowerCase()))
      .filter((p) => !criteria.condition || p.condition === criteria.condition)
      .filter((p) => criteria.minPriceInCents === undefined || p.priceInCents >= criteria.minPriceInCents)
      .filter((p) => criteria.maxPriceInCents === undefined || p.priceInCents <= criteria.maxPriceInCents)
      .filter((p) => criteria.storageGb === undefined || p.storageGb === criteria.storageGb)
      .filter((p) => !criteria.color || p.color?.toLowerCase() === criteria.color.toLowerCase())
      .filter((p) => criteria.inStock === undefined || (criteria.inStock ? p.stock > 0 : p.stock === 0));
    const sorted = [...filtered].sort((a,b) => criteria.sort === "price-asc" ? a.priceInCents-b.priceInCents : criteria.sort === "price-desc" ? b.priceInCents-a.priceInCents : 0);
    const start = (page - 1) * pageSize;
    return { items: sorted.slice(start, start + pageSize), total: sorted.length, page, pageSize };
  }
}
