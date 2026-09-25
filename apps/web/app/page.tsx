import Image from "next/image";
import StoreHeader from "./components/StoreHeader";
import Link from "next/link";
import { listPublicCategories } from "../lib/catalog";
import HomeCarousel from "./components/HomeCarousel";
import HomeCollectionCarousel from "./components/HomeCollectionCarousel";
import {
  listHomeProductItems,
  listHomeServiceItems,
  listPublicHomeSlides,
} from "../lib/homeCarousel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await listPublicCategories();
  const slides = await listPublicHomeSlides();
  const products = await listHomeProductItems();
  const services = await listHomeServiceItems();
  const marketing = await publicMarketing();
  const [banners, featured] = await Promise.all([marketing.banners("HOME"), marketing.featured("HOME")]);
  return (
    <main className="store-shell">
      <StoreHeader activeHref="/" />
      {slides.length > 0 && <HomeCarousel slides={slides} />}
      <section className="home-intro">
        <div>
          <p className="eyebrow">Smartphones · Servicios · Confianza</p>
          <h1>Tecnología que eliges con confianza.</h1>
          <p>
            Compra smartphones nuevos, usados o reacondicionados y solicita servicios técnicos
            legítimos desde una experiencia simple y segura.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/catalog">
              Explorar catálogo
            </Link>
            <Link className="button secondary" href="/servicios">
              Ver servicios
            </Link>
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="categories-title">
        <div className="section-heading">
          <p className="eyebrow">Categorías</p>
          <h2 id="categories-title">Encuentra lo que buscas.</h2>
        </div>
        {categories.length > 0 ? (
          <div className="category-grid">
            {categories.map((category) => (
              <Link
                className="category-card"
                href={`/catalog?category=${encodeURIComponent(category.slug)}`}
                key={category.id}
              >
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    width={640}
                    height={360}
                    sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 20vw"
                    unoptimized={category.imageUrl.startsWith("/api/media/")}
                  />
                ) : (
                  <span className="category-card-placeholder" aria-hidden="true" />
                )}
                <span>{category.name}</span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No hay categorías publicadas.</h2>
            <p>Las categorías activas aparecerán aquí cuando se creen desde administración.</p>
            <Link href="/catalog">Ver catálogo</Link>
          </div>
        )}
      </section>
      <MarketingBanners items={banners} />
      <FeaturedContent items={featured} />\n      <HomeCollectionCarousel title="Productos destacados." items={products} />
      <HomeCollectionCarousel title="Servicios disponibles." items={services} />
      <section className="section split-section">
        <div>
          <p className="eyebrow">Compra con tranquilidad</p>
          <h2>Inventario, estado y garantía claros.</h2>
        </div>
        <p>
          Cada producto muestra condición, capacidad, color, estado de batería cuando corresponde,
          garantía, disponibilidad y opciones de entrega.
        </p>
      </section>
      <section className="section service-banner">
        <div>
          <p className="eyebrow">Servicios</p>
          <h2>También cuidamos tu dispositivo.</h2>
          <p>
            Diagnóstico, reparación, configuración y seguimiento de solicitudes con procesos
            legítimos.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button secondary" style={{ color: "#171715" }} href="/servicios">
            Conocer servicios
          </Link>
          <Link className="button secondary" style={{ color: "#171715" }} href="/contacto">
            Contactarnos
          </Link>
        </div>
      </section>
    </main>
  );
}
