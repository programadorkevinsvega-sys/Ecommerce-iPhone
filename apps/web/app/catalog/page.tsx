import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listPublicCategories, searchCatalog } from "../../lib/catalog";
import { normalizeSearchQuery } from "../../lib/inputValidation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catálogo de smartphones | Ecommerce iPhone",
  description: "Explora smartphones por categoría, marca, condición y precio.",
  alternates: { canonical: "/catalog" },
};

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    cents / 100,
  );
const productHref = (slug: string) => `/iphone/${slug}`;
type Condition = "NEW" | "USED" | "REFURBISHED";
type Sort = "newest" | "price-asc" | "price-desc";
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = normalizeSearchQuery(typeof params.q === "string" ? params.q : undefined);
  const brand =
    typeof params.brand === "string" ? params.brand.trim().slice(0, 80) || undefined : undefined;
  const requestedCategory =
    typeof params.category === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.category)
      ? params.category
      : undefined;
  const condition =
    typeof params.condition === "string" &&
    (["NEW", "USED", "REFURBISHED"] as const).includes(params.condition as Condition)
      ? (params.condition as Condition)
      : undefined;
  const sort =
    typeof params.sort === "string" &&
    (["newest", "price-asc", "price-desc"] as const).includes(params.sort as Sort)
      ? (params.sort as Sort)
      : "newest";
  const page = Math.max(1, Math.min(10000, Number(params.page ?? 1) || 1));
  const categories = await listPublicCategories();
  const category =
    requestedCategory && categories.some((item) => item.slug === requestedCategory)
      ? requestedCategory
      : undefined;
  const result = await searchCatalog({
    ...(q ? { q } : {}),
    ...(brand ? { brand } : {}),
    ...(category ? { category } : {}),
    ...(condition ? { condition } : {}),
    sort,
    page,
    pageSize: 12,
  });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const qs = (nextPage: number) =>
    new URLSearchParams({
      ...(q ? { q } : {}),
      ...(brand ? { brand } : {}),
      ...(category ? { category } : {}),
      ...(condition ? { condition } : {}),
      sort,
      page: String(nextPage),
    }).toString();

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="brand-mark">
          Ecommerce iPhone
        </Link>
        <nav aria-label="Principal">
          <Link href="/">Inicio</Link>
          <Link href="/catalog" aria-current="page">
            Catálogo
          </Link>
          <Link href="/servicios">Servicios</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/cart">Carrito</Link>
        </nav>
      </header>
      <section className="catalog-hero">
        <p className="eyebrow">Catálogo</p>
        <h1>Encuentra tu próximo smartphone.</h1>
        <p>Inventario real, productos verificados y opciones nuevas, usadas y reacondicionadas.</p>
      </section>
      <section className="catalog-layout" aria-label="Catálogo de productos">
        <form className="filters" method="get" aria-label="Filtros de catálogo">
          <label htmlFor="catalog-search">
            Buscar
            <input
              id="catalog-search"
              defaultValue={q}
              placeholder="iPhone, Galaxy..."
              name="q"
              type="search"
              maxLength={100}
              autoComplete="off"
              inputMode="search"
            />
          </label>
          <label htmlFor="catalog-category">
            Categoría
            <select id="catalog-category" defaultValue={category ?? ""} name="category">
              <option value="">Todas</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="catalog-condition">
            Condición
            <select id="catalog-condition" defaultValue={condition ?? ""} name="condition">
              <option value="">Todas</option>
              <option value="NEW">Nuevo</option>
              <option value="USED">Usado</option>
              <option value="REFURBISHED">Reacondicionado</option>
            </select>
          </label>
          <label htmlFor="catalog-sort">
            Ordenar
            <select id="catalog-sort" defaultValue={sort} name="sort">
              <option value="newest">Más recientes</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
            </select>
          </label>
          <button type="submit">Aplicar filtros</button>
          <Link href="/catalog" className="text-link">
            Limpiar filtros
          </Link>
        </form>
        <div className="catalog-results">
          <div className="results-heading">
            <p>{result.total} productos</p>
            <span>
              Página {result.page} de {pages}
            </span>
          </div>
          {result.items.length === 0 ? (
            <div className="empty-state">
              <h2>No encontramos productos.</h2>
              <p>Prueba con otra búsqueda o elimina algún filtro.</p>
              <Link href="/catalog">Ver todo el catálogo</Link>
            </div>
          ) : (
            <div className="product-grid">
              {result.items.map((product) => (
                <Link
                  prefetch={false}
                  href={productHref(product.slug)}
                  className="product-card"
                  key={product.id}
                >
                  <div className="product-image" aria-hidden={product.images.length === 0}>
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={`${product.name} — ${product.color ?? product.brand}`}
                        width={640}
                        height={640}
                        sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 33vw"
                      />
                    ) : (
                      <span aria-hidden="true">{product.brand}</span>
                    )}
                  </div>
                  <p className="eyebrow">{product.brand}</p>
                  <h2>{product.name}</h2>
                  <p>
                    {product.condition === "NEW"
                      ? "Nuevo"
                      : product.condition === "USED"
                        ? "Usado"
                        : "Reacondicionado"}
                    {product.storageGb ? ` · ${product.storageGb} GB` : ""}
                  </p>
                  <strong>{money(product.priceInCents, product.currency)}</strong>
                  <span className="stock-note">
                    {product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav className="pagination" aria-label="Paginación">
              <span>
                {page > 1 ? <Link href={`/catalog?${qs(page - 1)}`}>Anterior</Link> : null}
              </span>
              <span>
                {page < pages ? <Link href={`/catalog?${qs(page + 1)}`}>Siguiente</Link> : null}
              </span>
            </nav>
          )}
        </div>
      </section>
    </main>
  );
}
