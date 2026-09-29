export type JsonLd = Readonly<Record<string, unknown>>;

export function organizationSchema(config: { name: string; url: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": config.url + "/#organization",
    name: config.name,
    url: config.url,
  };
}

export function websiteSchema(config: { name: string; url: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": config.url + "/#website",
    name: config.name,
    url: config.url,
    publisher: { "@id": config.url + "/#organization" },
  };
}

export function breadcrumbSchema(
  items: readonly Readonly<{ name: string; url: string }>[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function productSchema(input: {
  url: string;
  name: string;
  description: string;
  sku: string;
  brand: string;
  images: readonly string[];
  priceInCents: number;
  currency: string;
  inStock: boolean;
  itemCondition?: "NEW" | "USED" | "REFURBISHED";
  reviews?: readonly Readonly<{
    id: string;
    rating: number;
    body: string;
    customerName: string;
    verifiedPurchase: boolean;
  }>[];
}): JsonLd {
  const reviews = input.reviews ?? [];
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": input.url + "#product",
    name: input.name,
    description: input.description,
    sku: input.sku,
    brand: { "@type": "Brand", name: input.brand },
    image: input.images,
    offers: {
      "@type": "Offer",
      url: input.url,
      price: (input.priceInCents / 100).toFixed(2),
      priceCurrency: input.currency,
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      ...(input.itemCondition
        ? {
            itemCondition:
              input.itemCondition === "NEW"
                ? "https://schema.org/NewCondition"
                : input.itemCondition === "REFURBISHED"
                  ? "https://schema.org/RefurbishedCondition"
                  : "https://schema.org/UsedCondition",
          }
        : {}),
    },
  };

  if (reviews.length > 0) {
    const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(average.toFixed(2)),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    };
    schema.review = reviews.map((review) => ({
      "@type": "Review",
      "@id": input.url + "#review-" + review.id,
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: review.body,
      author: { "@type": "Person", name: review.customerName },
    }));
  }

  return schema;
}

export function articleSchema(input: {
  url: string;
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": input.url + "#article",
    headline: input.headline,
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: [input.image] } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    mainEntityOfPage: input.url,
  };
}

export function faqSchema(
  items: readonly Readonly<{ question: string; answer: string }>[],
): JsonLd | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
