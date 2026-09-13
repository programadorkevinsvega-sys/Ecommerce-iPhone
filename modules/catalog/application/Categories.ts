import type { AuditPort } from "../../admin/application/AuditPort";
import { DEFAULT_AUTHORIZATION_POLICY, type AdminRole, type AuthorizationPolicy, type Permission } from "../../admin/application/Rbac";
import { Category, categorySlugFromName, normalizeCategorySlug } from "../domain/Category";
import type { CategoryPrimitives, CategoryRepository } from "./CategoryRepository";

export type CategoryActor = { id: string; email: string; role: AdminRole };
export const CATEGORIES_CACHE_TAG = "catalog-categories";

const CATEGORY_WRITE_PERMISSION = "categories:write" as Permission;
const CATEGORY_READ_PERMISSION = "categories:read" as Permission;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

function cleanQuery(value: unknown): string | undefined {
  const query = typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, 100) : "";
  return query || undefined;
}

function parseActive(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  throw new Error("INVALID_CATEGORY_ACTIVE");
}

function categoryPayload(input: Record<string, unknown>, fallback?: CategoryPrimitives) {
  const name = input.name === undefined ? fallback?.name ?? "" : String(input.name);
  const suppliedSlug = input.slug === undefined ? fallback?.slug ?? categorySlugFromName(name) : String(input.slug);
  const slug = suppliedSlug.trim() ? normalizeCategorySlug(suppliedSlug) : categorySlugFromName(name);
  return { name, slug, active: parseActive(input.active, fallback?.active ?? true) };
}

export class PublicCategories {
  constructor(private readonly repository: CategoryRepository) {}

  async list(): Promise<readonly CategoryPrimitives[]> {
    return this.repository.list({ includeInactive: false });
  }

  async findBySlug(slug: string): Promise<CategoryPrimitives | null> {
    const category = await this.repository.findBySlug(normalizeCategorySlug(slug), { includeInactive: false });
    return category?.toPrimitives() ?? null;
  }
}

export class AdminCategories {
  private readonly authorizationPolicy: AuthorizationPolicy;

  constructor(
    private readonly repository: CategoryRepository,
    private readonly audit: AuditPort,
    authorizationPolicy?: AuthorizationPolicy,
  ) {
    this.authorizationPolicy = authorizationPolicy ?? DEFAULT_AUTHORIZATION_POLICY;
  }

  async list(input: { actor: CategoryActor; query?: unknown }): Promise<readonly CategoryPrimitives[]> {
    this.authorize(input.actor, CATEGORY_READ_PERMISSION);
    const query = cleanQuery(input.query);
    return this.repository.list({ includeInactive: true, ...(query ? { query } : {}) });
  }

  async get(input: { actor: CategoryActor; id: string }): Promise<CategoryPrimitives> {
    this.authorize(input.actor, CATEGORY_READ_PERMISSION);
    const category = await this.repository.findById(input.id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    return category.toPrimitives();
  }

  async create(input: { actor: CategoryActor; body: unknown }): Promise<CategoryPrimitives> {
    this.authorize(input.actor, CATEGORY_WRITE_PERMISSION);
    const payload = categoryPayload(asRecord(input.body));
    const category = Category.create(crypto.randomUUID(), payload);
    await this.ensureUniqueSlug(category.toPrimitives().slug);
    await this.repository.save(category);
    const created = category.toPrimitives();
    await this.audit.audit(input.actor.id, "ADMIN_CATEGORY_CREATED", "category", created.id, { slug: created.slug });
    return created;
  }

  async update(input: { actor: CategoryActor; id: string; body: unknown }): Promise<CategoryPrimitives> {
    this.authorize(input.actor, CATEGORY_WRITE_PERMISSION);
    const current = await this.repository.findById(input.id);
    if (!current) throw new Error("CATEGORY_NOT_FOUND");
    const record = asRecord(input.body);
    const allowed = ["name", "slug", "active"];
    if (!Object.keys(record).some((key) => allowed.includes(key))) throw new Error("NO_EDITABLE_CATEGORY_FIELDS");
    const payload = categoryPayload(record, current.toPrimitives());
    const category = Category.create(input.id, { ...current.toPrimitives(), ...payload, updatedAt: new Date().toISOString() });
    await this.ensureUniqueSlug(category.toPrimitives().slug, input.id);
    await this.repository.save(category);
    const updated = category.toPrimitives();
    await this.audit.audit(input.actor.id, "ADMIN_CATEGORY_UPDATED", "category", updated.id, { slug: updated.slug, active: updated.active });
    return updated;
  }

  async deactivate(input: { actor: CategoryActor; id: string }): Promise<void> {
    this.authorize(input.actor, CATEGORY_WRITE_PERMISSION);
    const changed = await this.repository.deactivate(input.id);
    if (!changed) throw new Error("CATEGORY_NOT_FOUND");
    await this.audit.audit(input.actor.id, "ADMIN_CATEGORY_DEACTIVATED", "category", input.id, {});
  }

  private authorize(actor: CategoryActor, permission: Permission): void {
    if (!this.authorizationPolicy.can(actor.role, permission)) throw new Error("FORBIDDEN");
  }

  private async ensureUniqueSlug(slug: string, currentId?: string): Promise<void> {
    const existing = await this.repository.findBySlug(slug, { includeInactive: true });
    if (existing && existing.getId() !== currentId) throw new Error("CATEGORY_SLUG_EXISTS");
  }
}
