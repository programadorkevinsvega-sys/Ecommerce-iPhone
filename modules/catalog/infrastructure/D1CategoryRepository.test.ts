import { describe, expect, it } from "vitest";
import { D1SqliteTestDatabase } from "../../orders/infrastructure/D1SqliteTestDatabase";
import { Category } from "../domain/Category";
import { D1CategoryRepository } from "./D1CategoryRepository";

function testDb() {
  const db = new D1SqliteTestDatabase();
  db.exec(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      image_url TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return db;
}

describe("D1CategoryRepository", () => {
  it("persists and lists active categories", async () => {
    const db = testDb();
    const repo = new D1CategoryRepository(db.asD1());
    await repo.save(Category.create("cat-1", { name: "Smartphones", slug: "smartphones", active: true }));
    expect(await repo.findBySlug("smartphones")).not.toBeNull();
    expect(await repo.list()).toHaveLength(1);
    db.close();
  });

  it("deactivates categories without deleting records", async () => {
    const db = testDb();
    const repo = new D1CategoryRepository(db.asD1());
    await repo.save(Category.create("cat-1", { name: "Smartphones", slug: "smartphones", active: true }));
    await repo.deactivate("cat-1");
    expect(await repo.list()).toEqual([]);
    expect((await repo.list({ includeInactive: true })).at(0)?.active).toBe(false);
    db.close();
  });
});
