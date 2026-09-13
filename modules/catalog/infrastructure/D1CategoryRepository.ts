import type { D1Database } from "@cloudflare/workers-types";
import { Category } from "../domain/Category";
import type { CategoryListCriteria, CategoryPrimitives, CategoryRepository } from "../application/CategoryRepository";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  active: number;
  created_at: string;
  updated_at: string;
};

function hydrate(row: CategoryRow): Category {
  return Category.create(row.id, {
    name: row.name,
    slug: row.slug,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function primitives(row: CategoryRow): CategoryPrimitives {
  return hydrate(row).toPrimitives();
}

export class D1CategoryRepository implements CategoryRepository {
  constructor(private readonly db: D1Database) {}

  async list(criteria: CategoryListCriteria = {}): Promise<readonly CategoryPrimitives[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (!criteria.includeInactive) where.push("active = 1");
    if (criteria.query) {
      where.push("(name LIKE ? OR slug LIKE ?)");
      values.push(`%${criteria.query}%`, `%${criteria.query}%`);
    }
    const predicate = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await this.db.prepare(`SELECT id,name,slug,active,created_at,updated_at FROM categories ${predicate} ORDER BY active DESC, name ASC`).bind(...values).all<CategoryRow>();
    return rows.results.map(primitives);
  }

  async findById(id: string): Promise<Category | null> {
    const row = await this.db.prepare("SELECT id,name,slug,active,created_at,updated_at FROM categories WHERE id = ? LIMIT 1").bind(id).first<CategoryRow>();
    return row ? hydrate(row) : null;
  }

  async findBySlug(slug: string, criteria: { includeInactive?: boolean } = {}): Promise<Category | null> {
    const row = await this.db.prepare(`SELECT id,name,slug,active,created_at,updated_at FROM categories WHERE slug = ?${criteria.includeInactive ? "" : " AND active = 1"} LIMIT 1`).bind(slug).first<CategoryRow>();
    return row ? hydrate(row) : null;
  }

  async save(category: Category): Promise<void> {
    const p = category.toPrimitives();
    await this.db.prepare(
      `INSERT INTO categories (id,name,slug,active,created_at,updated_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         slug=excluded.slug,
         active=excluded.active,
         updated_at=CURRENT_TIMESTAMP`,
    ).bind(p.id, p.name, p.slug, p.active ? 1 : 0, p.createdAt, p.updatedAt).run();
  }

  async deactivate(id: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE categories SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    return result.meta.changes === 1;
  }
}
