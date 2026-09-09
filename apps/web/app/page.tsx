import Link from "next/link";

const categories = ["iPhone", "Samsung", "Xiaomi", "Motorola", "Accesorios"];

export default function HomePage() {
  return (
    <main className="store-shell">
      <header className="store-header"><span className="brand">Ecommerce iPhone</span><nav><Link href="/">Inicio</Link><Link href="/catalog">Catálogo</Link><Link href="/servicios">Servicios</Link></nav></header>
      <section className="home-hero"><div><p className="eyebrow">Smartphones · Servicios · Confianza</p><h1>Tecnología que eliges con confianza.</h1><p>Compra smartphones nuevos, usados o reacondicionados y solicita servicios técnicos legítimos desde una experiencia simple y segura.</p><div className="hero-actions"><Link className="button primary" href="/catalog">Explorar catálogo</Link><Link className="button secondary" href="/servicios">Ver servicios</Link></div></div><div className="hero-device" aria-hidden="true"><span>iPhone</span></div></section>
      <section className="section" aria-labelledby="categories-title"><div className="section-heading"><p className="eyebrow">Categorías</p><h2 id="categories-title">Encuentra lo que buscas.</h2></div><div className="category-grid">{categories.map((category) => <Link className="category-card" href={`/catalog?brand=${encodeURIComponent(category)}`} key={category}><span>{category}</span><span aria-hidden="true">↗</span></Link>)}</div></section>
      <section className="section split-section"><div><p className="eyebrow">Compra con tranquilidad</p><h2>Inventario, estado y garantía claros.</h2></div><p>Cada producto podrá mostrar condición, capacidad, color, estado de batería cuando corresponda, garantía, disponibilidad y opciones de entrega.</p></section>
      <section className="section service-banner"><div><p className="eyebrow">Servicios</p><h2>También cuidamos tu dispositivo.</h2><p>Desbloqueos legítimos, diagnóstico, reparación y configuración con seguimiento de la solicitud.</p></div><Link className="button secondary" href="/servicios">Conocer servicios</Link></section>
    </main>
  );
}
