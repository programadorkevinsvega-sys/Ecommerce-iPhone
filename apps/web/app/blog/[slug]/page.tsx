import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articleSchema, breadcrumbSchema } from "../../../../../modules/seo/application/StructuredData";
import StoreHeader from "../../components/StoreHeader";
import { publicContent } from "../../../lib/publicContent";
import { contentCanonical, publicMetadataWithOverrides, canonicalForPath } from "../../../lib/seo";
import { serializeJsonLd } from "../../../lib/jsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await (await publicContent()).get("blog", slug);
  if (!p) return { title: "Contenido no encontrado", robots: { index: false, follow: false } };
  const path = "/blog/" + p.slug;
  const seo = contentCanonical({ path, ...(p.canonicalUrl ? { storedCanonicalUrl: p.canonicalUrl } : {}) });
  return publicMetadataWithOverrides({
    title: p.seoTitle ?? p.title,
    ...(p.seoDescription ?? p.excerpt ? { description: p.seoDescription ?? p.excerpt } : {}),
    ...(p.coverImageUrl ? { image: p.coverImageUrl } : {}),
    path,
    type: "article",
    noindex: seo.noindex,
    canonical: seo.canonical,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await (await publicContent()).get("blog", slug);
  if (!p) notFound();
  const url = canonicalForPath("/blog/" + p.slug);
  const article = articleSchema({
    url,
    headline: p.title,
    ...(p.excerpt ? { description: p.excerpt } : {}),
    ...(p.coverImageUrl ? { image: canonicalForPath(p.coverImageUrl) } : {}),
    ...(p.publishedAt ? { datePublished: p.publishedAt } : {}),
  });
  const breadcrumbs = breadcrumbSchema([
    { name: "Inicio", url: canonicalForPath("/") },
    { name: "Blog", url: canonicalForPath("/blog") },
    { name: p.title, url },
  ]);
  return (
    <main className="store-shell">
      <StoreHeader activeHref="/blog" />
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link><span>/</span><Link href="/blog">Blog</Link><span>/</span><span aria-current="page">{p.title}</span>
      </nav>
      <article className="content-article">
        <p className="eyebrow">Blog · {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("es-CO") : ""}</p>
        <h1>{p.title}</h1>
        {p.excerpt && <p>{p.excerpt}</p>}
        <div className="content-body">{p.content}</div>
      </article>
      <script id="article-jsonld" type="application/ld+json">{serializeJsonLd(article)}</script>
      <script id="article-breadcrumb-jsonld" type="application/ld+json">{serializeJsonLd(breadcrumbs)}</script>
    </main>
  );
}
