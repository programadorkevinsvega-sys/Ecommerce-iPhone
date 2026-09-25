import type {Metadata} from "next";
import StoreHeader from "../components/StoreHeader";
import {publicMarketing} from "../../lib/publicMarketing";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Preguntas frecuentes | Ecommerce iPhone",description:"Respuestas oficiales sobre compras, productos, servicios, entregas y garantías.",alternates:{canonical:"/faq"}};
export default async function FaqPage(){const items=await (await publicMarketing()).faqs();return <main className="store-shell"><StoreHeader activeHref="/faq"/><section className="catalog-hero"><p className="eyebrow">Ayuda</p><h1>Preguntas frecuentes.</h1><p>Información publicada por la tienda para ayudarte antes y después de tu compra.</p></section><section className="detail-section" aria-label="Preguntas frecuentes">{items.length?<div className="faq-list">{items.map(x=><details key={x.id}><summary>{x.question}</summary><p>{x.answer}</p></details>)}</div>:<div className="empty-state"><h2>Aún no hay preguntas publicadas.</h2><p>El contenido aparecerá aquí cuando el equipo editorial lo publique.</p></div>}</section></main>}
