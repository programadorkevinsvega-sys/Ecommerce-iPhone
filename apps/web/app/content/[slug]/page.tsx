import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { breadcrumbSchema } from "../../../../modules/seo/application/StructuredData";
import StoreHeader from "../../components/StoreHeader";
import { publicContent } from "../../../lib/publicContent";
import { contentCanonical, publicMetadataWithOverrides, canonicalForPath } from "../../../lib/seo";
import { serializeJsonLd } from "../../../lib/jsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await (await publicContent()).get("page", slug);
  if (!p) return { title: "Contenido no encontrado", robots: { index: false, follow: false } };
  const path = "/content/" + p.slug;
  const seo = contentCanonical({ path, storedCanonicalUrl: p.canonicalUrl });
  const metadata = await publicMetadataWithOverrides({
    title: p.seoTitle ?? p.title,
    description: p.seoDescription,
    path,
    noindex: seo.noindex,
    canonical: seo.canonical,
  });
  return metadata;
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await (await publicContent()).get("page", slug);
  if (!p) notFound();
  const url = canonicalForPath("/content/" + p.slug);
  const breadcrumbs = breadcrumbSchema([
    { name: "Inicio", url: canonicalForPath("/") },
    { name: p.title, url },
  ]);
  return (
    <main className="store-shell">
      <StoreHeader activeHref="/" />
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <a href="/">Inicio</a><span>/</span><span aria-current="page">{p.title}</span>
      </nav>
      <article className="content-article">
        <p className="eyebrow">Contenido</p>
        <h1>{p.title}</h1>
        <div className="content-body">{p.content}</div>
      </article>
      <Script id="cms-breadcrumb-jsonld" type="application/ld+json">{serializeJsonLd(breadcrumbs)}</Script>
    </main>
  );
}
