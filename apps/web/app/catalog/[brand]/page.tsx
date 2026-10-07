import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import StoreHeader from "../../components/StoreHeader";
import { searchCatalog } from "../../../lib/catalog";
import { publicMetadataWithOverrides } from "../../../lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>;
}): Promise<Metadata> {
  const { brand } = await params;
  const name = decodeURIComponent(brand).replace(/-/g, " ").trim();
  const result = await searchCatalog({ brand: name, page: 1, pageSize: 1 });
  return publicMetadataWithOverrides({
    title: name + " | Catálogo",
    description:
      result.total > 0
        ? "Explora " + result.total + " productos " + name + " disponibles en Ecommerce iPhone."
        : "No hay productos publicados de " + name + " en este momento.",
    path: "/catalog/" + brand,
    noindex: result.total === 0,
  });
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const name = decodeURIComponent(brand).replace(/-/g, " ").trim();
  const result = await searchCatalog({ brand: name, page: 1, pageSize: 24 });
  return (
    <main className="store-shell">
      <StoreHeader activeHref="/catalog" />
      <section className="catalog-hero">
        <p className="eyebrow">Marca</p>
        <h1>{name}.</h1>
        <p>
          {result.total > 0
            ? "Productos reales publicados para esta marca, con inventario, condición y precio."
            : "No hay productos publicados para esta marca."}
        </p>
        <Link className="button primary" href={"/catalog?brand=" + encodeURIComponent(name)}>
          Ver productos
        </Link>
      </section>
      {result.items.length > 0 && (
        <section className="product-grid category-products" aria-label={"Productos " + name}>
          {result.items.map((product) => (
            <Link href={"/iphone/" + product.slug} className="product-card" key={product.id}>
              <div className="product-image" aria-hidden={product.images.length === 0}>
                {product.images[0] ? (
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    width={640}
                    height={640}
                    sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 33vw"
                    unoptimized={product.images[0].startsWith("/api/media/")}
                  />
                ) : (
                  <span aria-hidden="true">{product.brand}</span>
                )}
              </div>
              <p className="eyebrow">{product.brand}</p>
              <h2>{product.name}</h2>
              <p>{product.condition === "NEW" ? "Nuevo" : product.condition === "USED" ? "Usado" : "Reacondicionado"}</p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
