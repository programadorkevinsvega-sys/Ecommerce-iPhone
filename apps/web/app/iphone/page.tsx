import type { Metadata } from "next";
import Link from "next/link";
import StoreHeader from "../components/StoreHeader";
import { searchCatalog } from "../../lib/catalog";
import { publicMetadataWithOverrides } from "../../lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return publicMetadataWithOverrides({
    title: "iPhone | Compra iPhone nuevo y reacondicionado",
    description: "Explora nuestro catálogo de iPhone nuevos y reacondicionados, con garantía y atención especializada.",
    path: "/iphone",
  });
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export default async function IphoneCategoryPage() {
  const result = await searchCatalog({ brand: "Apple", page: 1, pageSize: 24 });
  return (
    <main className="store-shell">
      <StoreHeader activeHref="/catalog" />
      <section className="catalog-hero">
        <p className="eyebrow">Apple iPhone</p>
        <h1>iPhone para cada necesidad.</h1>
        <p>Modelos nuevos y reacondicionados con inventario real, garantía y soporte especializado.</p>
      </section>
      <section className="product-grid category-products" aria-label="Productos iPhone">
        {result.items.map((p) => (
          <Link href={"/iphone/" + p.slug} className="product-card" key={p.id}>
            <div className="product-image">
              {p.images[0] ? <span>{p.name}</span> : <span>Apple</span>}
            </div>
            <p className="eyebrow">Apple</p>
            <h2>{p.name}</h2>
            <p>{p.condition === "NEW" ? "Nuevo" : p.condition === "USED" ? "Usado" : "Reacondicionado"}</p>
            <strong>{money(p.priceInCents, p.currency)}</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
