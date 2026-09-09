import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "../../../lib/catalog";

export const dynamic = "force-dynamic";
const money = (cents: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
const label = (c: string) => c === "NEW" ? "Nuevo" : c === "USED" ? "Usado" : "Reacondicionado";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const product = await getProductBySlug(slug); if (!product) return { title: "Producto no encontrado" };
  const p = product.toPrimitives();
  return { title: p.seoTitle ?? `${p.name} | Ecommerce iPhone`, description: p.seoDescription ?? p.description, alternates: { canonical: `/iphone/${p.slug}` }, openGraph: { title: p.name, description: p.description, type: "website", images: p.images[0] ? [{ url: p.images[0], alt: p.name }] : undefined } };
}

export default async function IphoneProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const product = await getProductBySlug(slug); if (!product) notFound(); const p = product.toPrimitives();
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description, sku: p.id, brand: { "@type": "Brand", name: p.brand }, image: p.images, offers: { "@type": "Offer", price: (p.priceInCents / 100).toFixed(0), priceCurrency: p.currency, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `/iphone/${p.slug}` }, "@id": `/iphone/${p.slug}` };
  return <main className="store-shell product-detail">
    <header className="store-header"><Link href="/" className="brand-mark">Ecommerce iPhone</Link><nav><Link href="/">Inicio</Link><Link href="/catalog">Catálogo</Link><Link href="/servicios">Servicios</Link></nav></header>
    <nav className="breadcrumbs" aria-label="Migas de pan"><Link href="/">Inicio</Link><span>/</span><Link href="/iphone">iPhone</Link><span>/</span><span>{p.name}</span></nav>
    <div className="product-detail-grid"><div className="product-gallery" aria-label={`Galería de ${p.name}`}><div className="product-image large" /></div><section><p className="eyebrow">{p.brand}</p><h1>{p.name}</h1><p className="product-model">{p.model}</p><p className="product-description">{p.description}</p><div className="product-price">{money(p.priceInCents, p.currency)}</div><dl className="specs"><div><dt>Condición</dt><dd>{label(p.condition)}</dd></div><div><dt>Disponibilidad</dt><dd>{p.stock > 0 ? `${p.stock} disponibles` : "Agotado"}</dd></div><div><dt>Garantía</dt><dd>{p.warrantyMonths} meses</dd></div>{p.batteryHealth !== undefined && <div><dt>Salud de batería</dt><dd>{p.batteryHealth}%</dd></div>}{p.storageGb !== undefined && <div><dt>Capacidad</dt><dd>{p.storageGb} GB</dd></div>}{p.color && <div><dt>Color</dt><dd>{p.color}</dd></div>}</dl><button type="button" disabled={p.stock === 0}>Agregar al carrito</button></section></div>
    <section className="detail-section"><p className="eyebrow">Especificaciones</p><h2>Todo lo que necesitas saber.</h2><dl className="specs spec-grid">{Object.entries(p.specs).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  </main>;
}
