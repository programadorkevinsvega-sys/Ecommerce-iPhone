import { AggregateRoot, DomainError, type DomainEvent } from "../../shared-kernel";
import { ProductId } from "./ProductId";

export type ProductCondition = "NEW" | "USED" | "REFURBISHED";

export type ProductProps = Readonly<{
  name: string; slug: string; brand: string; model: string; description: string;
  condition: ProductCondition; priceInCents: number; currency: string; stock: number;
  images: readonly string[]; active: boolean; warrantyMonths: number;
  batteryHealth?: number; storageGb?: number; color?: string;
  specs: Readonly<Record<string, string>>; seoTitle?: string; seoDescription?: string;
}>;

export class Product extends AggregateRoot<string> {
  private constructor(id: ProductId, private props: ProductProps) { super(id.value); }

  static create(id: ProductId, props: ProductProps): Product {
    if (!props.name.trim()) throw new DomainError("Product name is required");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(props.slug)) throw new DomainError("Invalid product slug");
    if (props.priceInCents < 0) throw new DomainError("Product price cannot be negative");
    if (props.stock < 0) throw new DomainError("Product stock cannot be negative");
    if (!props.currency.trim()) throw new DomainError("Product currency is required");
    if (props.warrantyMonths < 0) throw new DomainError("Warranty cannot be negative");
    if (props.batteryHealth !== undefined && (props.batteryHealth < 0 || props.batteryHealth > 100)) throw new DomainError("Invalid battery health");
    return new Product(id, { ...props, images: [...props.images], specs: { ...props.specs } });
  }

  activate(): void { this.props = { ...this.props, active: true }; }
  deactivate(): void { this.props = { ...this.props, active: false }; }
  toPrimitives(): ProductProps & { id: string } { return { id: this.getId(), ...this.props }; }
  record(event: DomainEvent): void { this.addDomainEvent(event); }
}
