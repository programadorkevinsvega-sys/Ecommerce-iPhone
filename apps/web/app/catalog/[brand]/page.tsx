import StoreHeader from "../../components/StoreHeader";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const name = decodeURIComponent(brand).replace(/-/g, " ");
  return { title: `${name} | Catálogo`, description: `Explora smartphones ${name} disponibles en Ecommerce iPhone.`, alternates: { canonical: `/catalog/${brand}` } };
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const name = decodeURIComponent(brand).replace(/-/g, " ");
  return <main className="store-shell"><StoreHeader activeHref="/catalog" /><section className="catalog-hero"><p className="eyebrow">Marca</p><h1>{name}.</h1><p>Catálogo preparado para mostrar productos reales, variantes, stock, condición y precio.</p><Link className="button primary" href={`/catalog?brand=${encodeURIComponent(name)}`}>Ver productos</Link></section></main>;
}
