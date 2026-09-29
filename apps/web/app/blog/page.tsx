import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import StoreHeader from "../components/StoreHeader";
import { publicContent } from "../../lib/publicContent";
import { publicMetadata } from "../../lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = publicMetadata({
  title: "Blog | Ecommerce iPhone",
  description: "Consejos, novedades y contenido editorial de Ecommerce iPhone.",
  path: "/blog",
});

export default async function BlogPage() {
  const rows = await (await publicContent()).list("blog");
  return (
    <main className="store-shell">
      <StoreHeader activeHref="/blog" />
      <section className="catalog-hero">
        <p className="eyebrow">Blog</p>
        <h1>Noticias y contenido.</h1>
        <p>Consejos, novedades y contenido editorial de la tienda.</p>
      </section>
      <section className="catalog-grid">
        {rows.map((p) => (
          <article className="product-card" key={p.slug}>
            {p.coverImageUrl && (
              <div className="relative aspect-video overflow-hidden">
                <Image
                  src={p.coverImageUrl}
                  alt={p.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <p className="eyebrow">
              {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("es-CO") : ""}
            </p>
            <h2>{p.title}</h2>
            {p.excerpt && <p>{p.excerpt}</p>}
            <Link className="button secondary" href={"/blog/" + p.slug}>
              Leer
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
