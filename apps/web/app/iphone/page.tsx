import StoreHeader from "../components/StoreHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { searchCatalog } from "../../lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "iPhone | Compra iPhone nuevo y reacondicionado", description: "Explora nuestro catálogo de iPhone nuevos y reacondicionados, con garantía y atención especializada.", alternates: { canonical: "/iphone" } };
const money = (cents: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export default async function IphoneCategoryPage() {
  const result = await searchCatalog({ brand: "Apple", page: 1, pageSize: 24 });
  return <main className="store-shell"><StoreHeader activeHref="/catalog" />
    <section className="catalog-hero"><p className="eyebrow">Apple iPhone</p><h1>iPhone para cada necesidad.</h1><p>Modelos nuevos y reacondicionados con inventario real, garantía y soporte especializado.</p></section>
    <section className="product-grid category-products">{result.items.map((p) => <Link href={`/iphone/${p.slug}`} className="product-card" key={p.id}><div className="product-image" aria-hidden="true"/><p className="eyebrow">Apple</p><h2>{p.name}</h2><p>{p.condition === "NEW" ? "Nuevo" : p.condition === "USED" ? "Usado" : "Reacondicionado"}</p><strong>{money(p.priceInCents,p.currency)}</strong></Link>)}</section>
  </main>;
}
