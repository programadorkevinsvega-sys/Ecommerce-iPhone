import { describe, expect, it } from "vitest";
import { contentCanonical, publicMetadata } from "./seo";

describe("web SEO adapter", () => {
  it("emits canonical, robots and social metadata", () => {
    const metadata = publicMetadata({
      title: "Producto",
      description: "Descripción",
      path: "/iphone/test",
    });
    expect(metadata.alternates?.canonical).toBe("https://iphone.jnmtortas.com/iphone/test");
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.openGraph?.url).toBe("https://iphone.jnmtortas.com/iphone/test");
    expect(metadata.twitter?.card).toBe("summary");
  });

  it("turns foreign CMS canonicals into noindex instead of publishing them", () => {
    expect(
      contentCanonical({
        path: "/content/guide",
        storedCanonicalUrl: "https://other.example/guide",
      }),
    ).toEqual({
      canonical: "https://iphone.jnmtortas.com/content/guide",
      noindex: true,
    });
  });
});
