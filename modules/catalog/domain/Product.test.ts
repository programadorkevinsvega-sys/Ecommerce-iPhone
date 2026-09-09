import { describe, expect, it } from "vitest";
import { Product } from "./Product";
import { ProductId } from "./ProductId";

const valid = () => Product.create(new ProductId("product-1"), {
  name: "iPhone 17 Pro Max", slug: "iphone-17-pro-max", brand: "Apple", model: "iPhone 17 Pro Max",
  description: "Premium smartphone", condition: "NEW", priceInCents: 6499900, currency: "COP", stock: 3,
  images: [], active: true, warrantyMonths: 12, storageGb: 256, specs: { Pantalla: "6.9 pulgadas" },
});

describe("Product", () => {
  it("creates a valid aggregate", () => expect(valid().toPrimitives().slug).toBe("iphone-17-pro-max"));
  it("rejects invalid slugs", () => expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, slug: "Bad Slug" })).toThrow());
  it("rejects negative prices", () => expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, priceInCents: -1 })).toThrow());
  it("rejects invalid battery health", () => expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, batteryHealth: 101 })).toThrow());
  it("supports activation state changes", () => { const product = valid(); product.deactivate(); expect(product.toPrimitives().active).toBe(false); product.activate(); expect(product.toPrimitives().active).toBe(true); });
});
