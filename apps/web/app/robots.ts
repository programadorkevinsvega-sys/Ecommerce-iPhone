import type { MetadataRoute } from "next";
import { siteConfig } from "../../modules/seo/application/SeoPolicy";

export default function robots(): MetadataRoute.Robots {
  const { origin } = siteConfig();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/_next/"],
        disallow: [
          "/admin",
          "/api",
          "/cart",
          "/checkout",
          "/cuenta",
          "/orders",
          "/technician",
        ],
      },
    ],
    sitemap: origin + "/sitemap.xml",
  };
}
