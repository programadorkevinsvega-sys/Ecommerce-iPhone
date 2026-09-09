import { describe, expect, it } from "vitest";
import { Product } from "../domain/Product";
import { ProductId } from "../domain/ProductId";
import { InMemoryProductRepository } from "./InMemoryProductRepository";

describe("ProductRepository adapter contract", () => {
  it("persists and retrieves a product through the repository port", async () => {
    const repository = new InMemoryProductRepository();
    const product = Product.create(
      ProductId.create("product-1"),
      { name: "iPhone Foundation", slug: "iphone-foundation", active: true },
    );

    await repository.save(product);

    await expect(repository.findById(ProductId.create("product-1"))).resolves.toBe(product);
  });
});
