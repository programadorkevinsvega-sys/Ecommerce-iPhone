import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catálogo de smartphones",
  description: "Explora iPhone, Samsung, Xiaomi, Motorola y accesorios por marca, condición y precio.",
  alternates: { canonical: "/catalog" },
};

const products = [
  { name: "iPhone Pro", brand: "Apple", condition: "Nuevo", price: "$0.00" },
  { name: "Galaxy Ultra", brand: "Samsung", condition: "Nuevo", price: "$0.00" },
  { name: "Xiaomi Pro", brand: "Xiaomi", condition: "Reacondicionado", price: "$0.00" },
];

export default function CatalogPage() {
  return (
    <main className="store-shell">
      <header className="store-header"><span>Ecommerce iPhone</span><nav><a href="/">Inicio</a><a href="/catalog">Catálogo</a><a href="/servicios">Servicios</a></nav></header>
      <section className="catalog-hero"><p className="eyebrow">Catálogo</p><h1>Encuentra tu próximo smartphone.</h1><p>Filtra por marca, condición y precio. El inventario real llegará desde el módulo Catalog.</p></section>
      <section className="catalog-layout" aria-label="Catálogo">
        <aside className="filters"><strong>Filtrar</strong><label>Buscar<input placeholder="iPhone, Galaxy..." name="q" /></label><label>Marca<select name="brand"><option value="">Todas</option><option>Apple</option><option>Samsung</option><option>Xiaomi</option><option>Motorola</option></select></label><label>Condición<select name="condition"><option value="">Todas</option><option>Nuevo</option><option>Usado</option><option>Reacondicionado</option></select></label></aside>
        <div className="product-grid">{products.map((product) => <article className="product-card" key={product.name}><div className="product-image" aria-hidden="true" /><p className="eyebrow">{product.brand}</p><h2>{product.name}</h2><p>{product.condition}</p><strong>{product.price}</strong></article>)}</div>
      </section>
    </main>
  );
}
