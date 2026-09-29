import type { Metadata } from "next";
import Script from "next/script";
import StoreHeader from "../components/StoreHeader";
import { publicMarketing } from "../../lib/publicMarketing";
import { publicMetadata, canonicalForPath } from "../../lib/seo";
import { breadcrumbSchema, faqSchema } from "../../../modules/seo/application/StructuredData";
import { serializeJsonLd } from "../../lib/jsonLd";

export const dynamic = "force-dynamic";
export const metadata: Metadata = publicMetadata({
  title: "Preguntas frecuentes | Ecommerce iPhone",
  description: "Respuestas oficiales sobre compras, productos, servicios, entregas y garantías.",
  path: "/faq",
});

export default async function FaqPage() {
  const items = await (await publicMarketing()).faqs();
  const faq = faqSchema(items.map((item) => ({ question: item.question, answer: item.answer })));
  const breadcrumbs = breadcrumbSchema([
    { name: "Inicio", url: canonicalForPath("/") },
    { name: "Preguntas frecuentes", url: canonicalForPath("/faq") },
  ]);
  return (
    <main className="store-shell">
      <StoreHeader activeHref="/faq" />
      <section className="catalog-hero">
        <p className="eyebrow">Ayuda</p>
        <h1>Preguntas frecuentes.</h1>
        <p>Información publicada por la tienda para ayudarte antes y después de tu compra.</p>
      </section>
      <section className="detail-section" aria-label="Preguntas frecuentes">
        {items.length ? (
          <div className="faq-list">
            {items.map((x) => (
              <details key={x.id}><summary>{x.question}</summary><p>{x.answer}</p></details>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>Aún no hay preguntas publicadas.</h2>
            <p>El contenido aparecerá aquí cuando el equipo editorial lo publique.</p>
          </div>
        )}
      </section>
      {faq && <Script id="faq-jsonld" type="application/ld+json">{serializeJsonLd(faq)}</Script>}
      <Script id="faq-breadcrumb-jsonld" type="application/ld+json">{serializeJsonLd(breadcrumbs)}</Script>
    </main>
  );
}
