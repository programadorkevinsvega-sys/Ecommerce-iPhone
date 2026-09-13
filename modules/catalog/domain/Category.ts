import { AggregateRoot, DomainError } from "../../shared-kernel";

export type CategoryProps = Readonly<{
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}>;

const CATEGORY_LIMITS = {
  name: 100,
  slug: 120,
} as const;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/gu;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").replace(CONTROL_CHARS, "").replace(/\s+/gu, " ").trim() : "";
}

export function normalizeCategorySlug(value: unknown): string {
  return cleanText(value).toLowerCase();
}

export function categorySlugFromName(name: string): string {
  return cleanText(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
}

export function validateCategoryProps(props: Omit<CategoryProps, "createdAt" | "updatedAt"> & Partial<Pick<CategoryProps, "createdAt" | "updatedAt">>): CategoryProps {
  const name = cleanText(props.name);
  const slug = normalizeCategorySlug(props.slug);
  if (!name || name.length > CATEGORY_LIMITS.name) throw new DomainError("INVALID_CATEGORY_NAME");
  if (!slug || slug.length > CATEGORY_LIMITS.slug || !SLUG_PATTERN.test(slug)) throw new DomainError("INVALID_CATEGORY_SLUG");
  if (typeof props.active !== "boolean") throw new DomainError("INVALID_CATEGORY_ACTIVE");
  const now = new Date().toISOString();
  return { name, slug, active: props.active, createdAt: props.createdAt ?? now, updatedAt: props.updatedAt ?? now };
}

export class Category extends AggregateRoot<string> {
  private constructor(id: string, private props: CategoryProps) {
    super(id);
  }

  static create(id: string, props: Omit<CategoryProps, "createdAt" | "updatedAt"> & Partial<Pick<CategoryProps, "createdAt" | "updatedAt">>): Category {
    const categoryId = cleanText(id);
    if (!categoryId || categoryId.length > 128) throw new DomainError("INVALID_CATEGORY_ID");
    return new Category(categoryId, validateCategoryProps(props));
  }

  rename(name: string, slug: string): void {
    this.props = validateCategoryProps({ ...this.props, name, slug, updatedAt: new Date().toISOString() });
  }

  activate(): void {
    this.props = { ...this.props, active: true, updatedAt: new Date().toISOString() };
  }

  deactivate(): void {
    this.props = { ...this.props, active: false, updatedAt: new Date().toISOString() };
  }

  toPrimitives(): CategoryProps & { id: string } {
    return { id: this.getId(), ...this.props };
  }
}
