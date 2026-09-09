import type { Metadata } from "next";
import { notFound } from "next/navigation";

const demoProduct = {
  name: "iPhone Pro",
  brand: "Apple",
  model: "iPhone Pro",
  description: "Smartphone premium. Esta ficha será alimentada por el catálogo persistido en D1.",
  condition: "Nuevo",
  price: "$0.00",
  stock: 0,
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return {};
  return {
    title: `${demoProduct.name} | Ecommerce iPhone`,
    description: demoProduct.description,
    alternates: { canonical: `/productos/${slug}` },
    openGraph: { title: demoProduct.name, description: demoProduct.description, type: "website" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: demoProduct.name,
    brand: { "@type": "Brand", name: demoProduct.brand },
    description: demoProduct.description,
    offers: { "@type": "Offer", price: "0.00", priceCurrency: "COP", availability: "https://schema.org/OutOfStock", url: `/productos/${slug}` },
  };
  return (
    <main className="store-shell product-detail">
      <header className="store-header"><span>Ecommerce iPhone</span><nav><a href="/">Inicio</a><a href="/catalog">Catálogo</a></nav></header>
      <div className="product-detail-grid"><div className="product-gallery" aria-label="Galería del producto"><div className="product-image large" /></div><section><p className="eyebrow">{demoProduct.brand}</p><h1>{demoProduct.name}</h1><p className="product-model">{demoProduct.model}</p><p className="product-description">{demoProduct.description}</p><div className="product-price">{demoProduct.price}</div><dl className="specs"><div><dt>Condición</dt><dd>{demoProduct.condition}</dd></div><div><dt>Disponibilidad</dt><dd>{demoProduct.stock > 0 ? "Disponible" : "Consultar"}</dd></div></dl><button type="button" disabled={demoProduct.stock === 0}>Agregar al carrito</button></section></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
