import type { ProductRepository } from "./ProductRepository";
import { ProductId } from "../domain/ProductId";

export type GetProductQuery = Readonly<{ productId: string }>;

export class GetProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(query: GetProductQuery) {
    const id = ProductId.create(query.productId);
    const product = await this.products.findById(id);
    return product?.toPrimitives() ?? null;
  }
}
