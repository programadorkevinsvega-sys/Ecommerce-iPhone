import type { ProductProps } from "../domain/Product";
import type { ProductRepository } from "./ProductRepository";

export type ProductSearch = Readonly<{
  q?: string; brand?: string; model?: string; condition?: ProductProps["condition"];
  minPriceInCents?: number; maxPriceInCents?: number; storageGb?: number; color?: string;
  inStock?: boolean; page?: number; pageSize?: number; sort?: "newest" | "price-asc" | "price-desc";
}>;

export type ProductSearchResult = Readonly<{ items: readonly (ProductProps & { id: string })[]; total: number; page: number; pageSize: number }>;
export interface ProductSearchRepository extends ProductRepository { search(criteria: ProductSearch): Promise<ProductSearchResult>; }
export class SearchProducts { constructor(private readonly products: ProductSearchRepository) {} execute(criteria: ProductSearch): Promise<ProductSearchResult> { return this.products.search(criteria); } }
