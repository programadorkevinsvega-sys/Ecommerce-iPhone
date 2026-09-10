import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { searchCatalog } from "../../lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catálogo de smartphones | Ecommerce iPhone",
  description: "Explora iPhone, Samsung y otros smartphones por marca, condición y precio.",
  alternates: { canonical: "/catalog" },
};

const money = (cents: number, currency: string) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency, maximumFractionDigits: 0,
}).format(cents / 100);

const productHref = (slug: string) => `/iphone/${slug}`;
type Condition = "NEW" | "USED" | "REFURBISHED";
type Sort = "newest" | "price-asc" | "price-desc";
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const brand = typeof params.brand === "string" ? params.brand : undefined;
  const condition = typeof params.condition === "string" && (["NEW", "USED", "REFURBISHED"] as const).includes(params.condition as Condition)
    ? params.condition as Condition : undefined;
  const sort = typeof params.sort === "string" && (["newest", "price-asc", "price-desc"] as const).includes(params.sort as Sort)
    ? params.sort as Sort : "newest";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const result = await searchCatalog({
    ...(q ? { q } : {}), ...(brand ? { brand } : {}), ...(condition ? { condition } : {}),
    sort, page, pageSize: 12,
  });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const qs = (nextPage: number) => new URLSearchParams({
    ...(q ? { q } : {}), ...(brand ? { brand } : {}), ...(condition ? { condition } : {}), sort, page: String(nextPage),
  }).toString();

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="brand-mark">Ecommerce iPhone</Link>
        <nav aria-label="Principal">
          <Link href="/">Inicio</Link><Link href="/catalog" aria-current="page">Catálogo</Link><Link href="/servicios">Servicios</Link><Link href="/cart">Carrito</Link>
        </nav>
      </header>
      <section className="catalog-hero">
        <p className="eyebrow">Catálogo</p>
        <h1>Encuentra tu próximo smartphone.</h1>
        <p>Inventario real, productos verificados y opciones nuevas, usadas y reacondicionadas.</p>
      </section>
      <section className="catalog-layout" aria-label="Catálogo de productos">
        <form className="filters" method="get">
          <strong>Filtrar productos</strong>
          <label>Buscar<input defaultValue={q} placeholder="iPhone, Galaxy..." name="q" /></label>
          <label>Marca<select defaultValue={brand ?? ""} name="brand"><option value="">Todas</option><option value="Apple">Apple</option><option value="Samsung">Samsung</option><option value="Xiaomi">Xiaomi</option><option value="Motorola">Motorola</option></select></label>
          <label>Condición<select defaultValue={condition ?? ""} name="condition"><option value="">Todas</option><option value="NEW">Nuevo</option><option value="USED">Usado</option><option value="REFURBISHED">Reacondicionado</option></select></label>
          <label>Ordenar<select defaultValue={sort} name="sort"><option value="newest">Más recientes</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option></select></label>
          <button type="submit">Aplicar filtros</button><Link href="/catalog" className="text-link">Limpiar filtros</Link>
        </form>
        <div className="catalog-results">
          <div className="results-heading"><p>{result.total} productos</p><span>Página {result.page} de {pages}</span></div>
          {result.items.length === 0 ? <div className="empty-state"><h2>No encontramos productos.</h2><p>Prueba con otra búsqueda o elimina algún filtro.</p><Link href="/catalog">Ver todo el catálogo</Link></div> : (
            <div className="product-grid">
              {result.items.map((product) => <Link href={productHref(product.slug)} className="product-card" key={product.id}>
                <div className="product-image" aria-hidden={product.images.length === 0}>
                  {product.images[0] ? <Image src={product.images[0]} alt={`${product.name} — ${product.color ?? product.brand}`} width={640} height={640} sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 33vw" /> : <span aria-hidden="true">{product.brand}</span>}
                </div>
                <p className="eyebrow">{product.brand}</p><h2>{product.name}</h2>
                <p>{product.condition === "NEW" ? "Nuevo" : product.condition === "USED" ? "Usado" : "Reacondicionado"}{product.storageGb ? ` · ${product.storageGb} GB` : ""}</p>
                <strong>{money(product.priceInCents, product.currency)}</strong>
                <span className="stock-note">{product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}</span>
              </Link>)}
            </div>
          )}
          {pages > 1 && <nav className="pagination" aria-label="Paginación"><span>{page > 1 ? <Link href={`/catalog?${qs(page - 1)}`}>Anterior</Link> : null}</span><span>{page < pages ? <Link href={`/catalog?${qs(page + 1)}`}>Siguiente</Link> : null}</span></nav>}
        </div>
      </section>
    </main>
  );
}
