import { describe, expect, it } from "vitest";
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  organizationSchema,
  productSchema,
  websiteSchema,
} from "./StructuredData";

describe("SEO structured data", () => {
  it("builds organization and website schemas with stable ids", () => {
    const organization = organizationSchema({ name: "Ecommerce iPhone", url: "https://iphone.jnmtortas.com" });
    const website = websiteSchema({ name: "Ecommerce iPhone", url: "https://iphone.jnmtortas.com" });
    expect(organization["@type"]).toBe("Organization");
    expect(organization["@id"]).toBe("https://iphone.jnmtortas.com/#organization");
    expect(website["@type"]).toBe("WebSite");
    expect(website["publisher"]).toEqual({ "@id": "https://iphone.jnmtortas.com/#organization" });
  });

  it("builds product offers from real commerce values", () => {
    const schema = productSchema({
      url: "https://iphone.jnmtortas.com/iphone/test",
      name: "iPhone real",
      description: "Descripción real",
      sku: "sku-real",
      brand: "Apple",
      images: ["https://iphone.jnmtortas.com/api/media/product-images/test.webp"],
      priceInCents: 499900,
      currency: "COP",
      inStock: true,
      itemCondition: "USED",
    });
    expect(schema["@type"]).toBe("Product");
    expect(schema["offers"]).toMatchObject({
      "@type": "Offer",
      price: "4999.00",
      priceCurrency: "COP",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
    });
  });

  it("emits reviews only when reviews actually exist", () => {
    const schema = productSchema({
      url: "https://iphone.jnmtortas.com/iphone/test",
      name: "iPhone real",
      description: "Descripción real",
      sku: "sku-real",
      brand: "Apple",
      images: [],
      priceInCents: 100000,
      currency: "COP",
      inStock: false,
      reviews: [{ id: "r1", rating: 5, body: "Excelente", customerName: "Cliente", verifiedPurchase: true }],
    });
    expect(schema["review"]).toHaveLength(1);
    expect(schema["aggregateRating"]).toMatchObject({ reviewCount: 1, ratingValue: 5 });
  });

  it("builds contextual article, breadcrumbs and FAQ", () => {
    expect(articleSchema({ url: "https://iphone.jnmtortas.com/blog/a", headline: "Guía" })["@type"]).toBe("Article");
    expect(breadcrumbSchema([{ name: "Inicio", url: "https://iphone.jnmtortas.com/" }])["itemListElement"]).toHaveLength(1);
    expect(faqSchema([])).toBeNull();
    expect(faqSchema([{ question: "Q", answer: "A" }])?.["@type"]).toBe("FAQPage");
  });
});
