import { describe, expect, it } from "vitest";
import { Product } from "../domain/Product";
import { ProductId } from "../domain/ProductId";
import { InMemoryProductRepository } from "./InMemoryProductRepository";

describe("ProductRepository adapter contract", () => {
  it("persists and retrieves a product through the repository port", async () => {
    const repository = new InMemoryProductRepository();
    const product = Product.create(ProductId.create("product-1"), {
      name: "iPhone Foundation", slug: "iphone-foundation", brand: "Apple", model: "iPhone Foundation",
      description: "Test product", condition: "NEW", priceInCents: 100, currency: "COP", stock: 1,
      images: [], active: true, warrantyMonths: 12, specs: {},
    });
    await repository.save(product);
    await expect(repository.findById(ProductId.create("product-1"))).resolves.toBe(product);
  });
});
