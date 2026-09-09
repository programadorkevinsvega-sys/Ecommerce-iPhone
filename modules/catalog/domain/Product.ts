import { AggregateRoot, type DomainEvent } from "../../shared-kernel";
import { ProductId } from "./ProductId";

export type ProductProps = Readonly<{
  name: string;
  slug: string;
  active: boolean;
}>;

export class Product extends AggregateRoot<string> {
  private constructor(
    id: ProductId,
    private props: ProductProps,
  ) {
    super(id.value);
  }

  static create(id: ProductId, props: ProductProps): Product {
    if (!props.name.trim()) throw new Error("Product name cannot be empty.");
    if (!props.slug.trim()) throw new Error("Product slug cannot be empty.");
    return new Product(id, { ...props });
  }

  activate(): void {
    this.props = { ...this.props, active: true };
  }

  deactivate(): void {
    this.props = { ...this.props, active: false };
  }

  toPrimitives(): ProductProps & { id: string } {
    return { id: this.getId(), ...this.props };
  }

  record(event: DomainEvent): void {
    this.addDomainEvent(event);
  }
}
