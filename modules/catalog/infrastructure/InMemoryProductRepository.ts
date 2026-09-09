import type { ProductRepository } from "../application/ProductRepository";
import type { Product } from "../domain/Product";
import type { ProductId } from "../domain/ProductId";

export class InMemoryProductRepository implements ProductRepository {
  private readonly items = new Map<string, Product>();

  async findById(id: ProductId): Promise<Product | null> {
    return this.items.get(id.value) ?? null;
  }

  async save(product: Product): Promise<void> {
    this.items.set(product.getId(), product);
  }
}
