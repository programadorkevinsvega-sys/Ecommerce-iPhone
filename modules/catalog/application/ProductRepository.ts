import type { Product } from "../domain/Product";
import type { ProductId } from "../domain/ProductId";

export interface ProductRepository {
  findById(id: ProductId): Promise<Product | null>;
  save(product: Product): Promise<void>;
}
