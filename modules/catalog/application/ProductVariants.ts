export type ProductVariant = Readonly<{
  id: string;
  productId: string;
  name: string;
  options: Readonly<Record<string, string | number>>;
  priceInCents: number;
}>;

export interface ProductVariantRepository {
  findByProductId(productId: string): Promise<readonly ProductVariant[]>;
}

export class GetProductVariants {
  constructor(private readonly repository: ProductVariantRepository) {}
  execute(productId: string): Promise<readonly ProductVariant[]> {
    return this.repository.findByProductId(productId);
  }
}
