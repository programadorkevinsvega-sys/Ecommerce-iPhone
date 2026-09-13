import { AggregateRoot, DomainError, type DomainEvent } from "../../shared-kernel";
import { ProductId } from "./ProductId";

export type ProductCondition = "NEW" | "USED" | "REFURBISHED";
export type ProductProps = Readonly<{
  name: string;
  slug: string;
  brand: string;
  model: string;
  description: string;
  condition: ProductCondition;
  priceInCents: number;
  currency: string;
  stock: number;
  images: readonly string[];
  active: boolean;
  warrantyMonths: number;
  batteryHealth?: number | undefined;
  storageGb?: number | undefined;
  color?: string | undefined;
  specs: Readonly<Record<string, string>>;
  seoTitle?: string | undefined;
  seoDescription?: string | undefined;
}>;

const PRODUCT_TEXT_LIMITS = {
  name: 180,
  slug: 180,
  brand: 80,
  model: 120,
  description: 5_000,
  color: 80,
  seoTitle: 180,
  seoDescription: 320,
  specKey: 80,
  specValue: 500,
  imageUrl: 2_048,
} as const;

function stringField(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new DomainError(`Invalid product ${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new DomainError(`Invalid product ${field}`);
  return normalized;
}

function integerField(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value) || value < min || value > max) {
    throw new DomainError(`Invalid product ${field}`);
  }
  return value;
}

function optionalIntegerField(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  return integerField(value, field, min, max);
}

function validateSpecs(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError("Invalid product specs");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 100) throw new DomainError("Too many product specs");
  const specs: Record<string, string> = {};
  for (const [key, raw] of entries) {
    const normalizedKey = stringField(key, "spec key", PRODUCT_TEXT_LIMITS.specKey);
    const normalizedValue = stringField(raw, "spec value", PRODUCT_TEXT_LIMITS.specValue);
    specs[normalizedKey] = normalizedValue;
  }
  return specs;
}

function validateImages(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 50) throw new DomainError("Invalid product images");
  return value.map((image) => {
    const url = stringField(image, "image", PRODUCT_TEXT_LIMITS.imageUrl);
    try {
      const parsed = new URL(url, "https://same-origin.invalid");
      if (parsed.origin !== "https://same-origin.invalid" || !parsed.pathname.startsWith("/products/")) throw new Error();
      if (parsed.search || parsed.hash || parsed.pathname.includes("\\")) throw new Error();
    } catch {
      throw new DomainError("Invalid product image URL");
    }
    return new URL(url, "https://same-origin.invalid").pathname;
  });
}

export function validateProductProps(props: ProductProps): ProductProps {
  const name = stringField(props.name, "name", PRODUCT_TEXT_LIMITS.name);
  const slug = stringField(props.slug, "slug", PRODUCT_TEXT_LIMITS.slug).toLowerCase();
  const brand = stringField(props.brand, "brand", PRODUCT_TEXT_LIMITS.brand);
  const model = stringField(props.model, "model", PRODUCT_TEXT_LIMITS.model);
  const description = stringField(props.description, "description", PRODUCT_TEXT_LIMITS.description);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new DomainError("Invalid product slug");
  if (!["NEW", "USED", "REFURBISHED"].includes(props.condition)) throw new DomainError("Invalid product condition");

  const priceInCents = integerField(props.priceInCents, "price", 0, 9_999_999_999);
  const stock = integerField(props.stock, "stock", 0, 1_000_000);
  const warrantyMonths = integerField(props.warrantyMonths, "warranty", 0, 120);
  const batteryHealth = optionalIntegerField(props.batteryHealth, "battery health", 0, 100);
  const storageGb = optionalIntegerField(props.storageGb, "storage", 1, 16_384);
  const currency = stringField(props.currency, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new DomainError("Invalid product currency");
  const color = props.color === undefined ? undefined : stringField(props.color, "color", PRODUCT_TEXT_LIMITS.color);
  const seoTitle = props.seoTitle === undefined ? undefined : stringField(props.seoTitle, "seo title", PRODUCT_TEXT_LIMITS.seoTitle);
  const seoDescription = props.seoDescription === undefined ? undefined : stringField(props.seoDescription, "seo description", PRODUCT_TEXT_LIMITS.seoDescription);

  return {
    ...props,
    name,
    slug,
    brand,
    model,
    description,
    priceInCents,
    stock,
    warrantyMonths,
    batteryHealth,
    storageGb,
    color,
    currency,
    images: validateImages(props.images),
    specs: validateSpecs(props.specs),
    seoTitle,
    seoDescription,
  };
}

export function validateProductPatch(fields: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(fields)) {
    switch (field) {
      case "name": stringField(value, "name", PRODUCT_TEXT_LIMITS.name); break;
      case "slug": {
        const slug = stringField(value, "slug", PRODUCT_TEXT_LIMITS.slug).toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new DomainError("Invalid product slug");
        break;
      }
      case "brand": stringField(value, "brand", PRODUCT_TEXT_LIMITS.brand); break;
      case "model": stringField(value, "model", PRODUCT_TEXT_LIMITS.model); break;
      case "description": stringField(value, "description", PRODUCT_TEXT_LIMITS.description); break;
      case "condition": if (!(["NEW", "USED", "REFURBISHED"] as readonly string[]).includes(String(value))) throw new DomainError("Invalid product condition"); break;
      case "price_in_cents": integerField(value, "price", 0, 9_999_999_999); break;
      case "stock": integerField(value, "stock", 0, 1_000_000); break;
      case "active": if (typeof value !== "boolean" && value !== 0 && value !== 1) throw new DomainError("Invalid product active flag"); break;
      case "seo_title": if (value !== null) stringField(value, "seo title", PRODUCT_TEXT_LIMITS.seoTitle); break;
      case "seo_description": if (value !== null) stringField(value, "seo description", PRODUCT_TEXT_LIMITS.seoDescription); break;
      case "warranty_months": if (value !== null) integerField(value, "warranty", 0, 120); break;
      case "battery_health": if (value !== null) optionalIntegerField(value, "battery health", 0, 100); break;
      case "storage_gb": if (value !== null) optionalIntegerField(value, "storage", 1, 16_384); break;
      case "color": if (value !== null) stringField(value, "color", PRODUCT_TEXT_LIMITS.color); break;
      case "specs_json": validateSpecs(typeof value === "string" ? parseSpecsJson(value) : value); break;
      default: throw new DomainError("Invalid product field");
    }
  }
}

function parseSpecsJson(value: string): unknown {
  if (value.length > 20_000) throw new DomainError("Invalid product specs");
  try {
    return JSON.parse(value);
  } catch {
    throw new DomainError("Invalid product specs");
  }
}

export class Product extends AggregateRoot<string> {
  private constructor(id: ProductId, private props: ProductProps) { super(id.value); }

  static create(id: ProductId, props: ProductProps): Product {
    return new Product(id, validateProductProps(props));
  }

  activate(): void { this.props = { ...this.props, active: true }; }
  deactivate(): void { this.props = { ...this.props, active: false }; }
  toPrimitives(): ProductProps & { id: string } { return { id: this.getId(), ...this.props }; }
  record(event: DomainEvent): void { this.addDomainEvent(event); }
}
