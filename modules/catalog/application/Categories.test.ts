import { describe, expect, it, vi } from "vitest";
import { RequireAdmin } from "../../admin/application/RequireAdmin";
import { AdminCategories, PublicCategories } from "./Categories";
import type { AuditPort } from "../../admin/application/AuditPort";
import type { CategoryListCriteria, CategoryRepository } from "./CategoryRepository";
import { Category } from "../domain/Category";

class MemoryCategoryRepository implements CategoryRepository {
  readonly items = new Map<string, Category>();

  async list(criteria: CategoryListCriteria = {}) {
    const query = criteria.query?.toLowerCase();
    return [...this.items.values()]
      .map((item) => item.toPrimitives())
      .filter((item) => criteria.includeInactive || item.active)
      .filter((item) => !query || item.name.toLowerCase().includes(query) || item.slug.includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findBySlug(slug: string, criteria: { includeInactive?: boolean } = {}) {
    return [...this.items.values()].find((item) => {
      const category = item.toPrimitives();
      return category.slug === slug && (criteria.includeInactive || category.active);
    }) ?? null;
  }

  async save(category: Category) {
    this.items.set(category.getId(), category);
  }

  async deactivate(id: string) {
    const category = this.items.get(id);
    if (!category) return false;
    category.deactivate();
    return true;
  }
}

const actor = { id: "admin-1", email: "admin@example.com", role: "ADMIN" as const };
const audit = (): AuditPort => ({ audit: vi.fn().mockResolvedValue(undefined) });

describe("AdminCategories", () => {
  it("creates a valid category", async () => {
    const repo = new MemoryCategoryRepository();
    const service = new AdminCategories(repo, audit());
    const category = await service.create({ actor, body: { name: "Smartphones", slug: "smartphones" } });
    expect(category.name).toBe("Smartphones");
    expect(category.slug).toBe("smartphones");
    expect(await repo.findById(category.id)).not.toBeNull();
  });

  it("rejects invalid names", async () => {
    const service = new AdminCategories(new MemoryCategoryRepository(), audit());
    await expect(service.create({ actor, body: { name: "", slug: "valid-slug" } })).rejects.toThrow("INVALID_CATEGORY_NAME");
  });

  it("rejects duplicate slugs", async () => {
    const repo = new MemoryCategoryRepository();
    const service = new AdminCategories(repo, audit());
    await service.create({ actor, body: { name: "Smartphones", slug: "smartphones" } });
    await expect(service.create({ actor, body: { name: "Phones", slug: "smartphones" } })).rejects.toThrow("CATEGORY_SLUG_EXISTS");
  });

  it("edits a category", async () => {
    const repo = new MemoryCategoryRepository();
    const service = new AdminCategories(repo, audit());
    const category = await service.create({ actor, body: { name: "Smartphones", slug: "smartphones" } });
    const updated = await service.update({ actor, id: category.id, body: { name: "Accesorios", slug: "accesorios", active: true } });
    expect(updated.name).toBe("Accesorios");
    expect(updated.slug).toBe("accesorios");
  });

  it("deactivates categories and hides them from public lists", async () => {
    const repo = new MemoryCategoryRepository();
    const admin = new AdminCategories(repo, audit());
    const publicCategories = new PublicCategories(repo);
    const category = await admin.create({ actor, body: { name: "Smartphones", slug: "smartphones" } });
    await admin.deactivate({ actor, id: category.id });
    expect(await publicCategories.list()).toEqual([]);
    expect((await admin.list({ actor })).at(0)?.active).toBe(false);
  });

  it("returns 403 for admins without write permission", async () => {
    const service = new AdminCategories(new MemoryCategoryRepository(), audit());
    await expect(service.create({ actor: { id: "sales-1", email: "sales@example.com", role: "SALES" }, body: { name: "Smartphones", slug: "smartphones" } })).rejects.toThrow("FORBIDDEN");
  });
});

describe("RequireAdmin", () => {
  it("returns 401 when no authenticated admin is resolved", async () => {
    const service = new RequireAdmin({ execute: vi.fn().mockResolvedValue(null) });
    await expect(service.execute(null, "categories:read")).rejects.toThrow("UNAUTHORIZED");
  });
});
