import { DomainError, ValueObject } from "../../shared-kernel";

export class ProductId extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(value: string): ProductId {
    const normalized = value.trim();
    if (!normalized) throw new DomainError("CATALOG_INVALID_PRODUCT_ID", "Product id cannot be empty.");
    return new ProductId(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
