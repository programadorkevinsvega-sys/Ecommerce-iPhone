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
  it("accepts canonical same-origin product assets", () => {
    const product = Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, images: ["/products/iphone-17-pro-max.webp"] });
    expect(product.toPrimitives().images).toEqual(["/products/iphone-17-pro-max.webp"]);
  });
  it("accepts trusted external images only through the internal proxy", () => {
    const source = "https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro_Max.jpg";
    const proxy = `/api/media/proxy?url=${encodeURIComponent(source)}`;
    const product = Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, images: [proxy] });
    expect(product.toPrimitives().images).toEqual([proxy]);
  });
  it("rejects external image hosts", () => expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, images: ["https://attacker.example/image.webp"] })).toThrow());
  it("rejects dangerous image schemes", () => {
    for (const image of ["javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "file:///etc/passwd", "//attacker.example/image.webp"]) {
      expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, images: [image] })).toThrow();
    }
  });
  it("rejects untrusted proxy targets", () => {
    const proxy = `/api/media/proxy?url=${encodeURIComponent("https://attacker.example/image.webp")}`;
    expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, images: [proxy] })).toThrow();
  });
  it("rejects image query and fragment injection", () => {
    expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, images: ["/products/image.webp?url=https://attacker.example"] })).toThrow();
    expect(() => Product.create(new ProductId("product-1"), { ...valid().toPrimitives(), id: undefined as never, images: ["/products/image.webp#external"] })).toThrow();
  });
  it("supports activation state changes", () => { const product = valid(); product.deactivate(); expect(product.toPrimitives().active).toBe(false); product.activate(); expect(product.toPrimitives().active).toBe(true); });
});
