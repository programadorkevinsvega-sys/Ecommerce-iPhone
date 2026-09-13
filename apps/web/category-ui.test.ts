import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("category UI data flow", () => {
  it("Home consumes public categories from the catalog application", () => {
    const source = readFileSync(join(root, "app/page.tsx"), "utf8");
    expect(source).toContain("listPublicCategories");
    expect(source).not.toMatch(/const\s+categories\s*=\s*\[/);
    expect(source).not.toContain("brand:\"Apple\"");
    expect(source).not.toContain("brand:\"Samsung\"");
  });

  it("Catalog renders category options from public categories", () => {
    const source = readFileSync(join(root, "app/catalog/page.tsx"), "utf8");
    expect(source).toContain("listPublicCategories");
    expect(source).toContain("name=\"category\"");
    expect(source).not.toContain("<option value=\"Apple\">Apple</option>");
    expect(source).not.toContain("<option value=\"Samsung\">Samsung</option>");
    expect(source).not.toContain("<option value=\"Xiaomi\">Xiaomi</option>");
    expect(source).not.toContain("<option value=\"Motorola\">Motorola</option>");
  });
});
