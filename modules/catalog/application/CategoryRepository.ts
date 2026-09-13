import type { Category } from "../domain/Category";

export type CategoryPrimitives = ReturnType<Category["toPrimitives"]>;
export type CategoryListCriteria = Readonly<{ includeInactive?: boolean; query?: string }>;

export interface CategoryRepository {
  list(criteria?: CategoryListCriteria): Promise<readonly CategoryPrimitives[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string, criteria?: { includeInactive?: boolean }): Promise<Category | null>;
  save(category: Category): Promise<void>;
  deactivate(id: string): Promise<boolean>;
}
