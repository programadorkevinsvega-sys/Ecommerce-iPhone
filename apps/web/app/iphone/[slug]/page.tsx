import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "../../../components/AddToCartButton";
import { getProductBySlug, searchCatalog } from "../../../lib/catalog";

export const dynamic = "force-dynamic";
const money = (cents:number,currency:string) => new Intl.NumberFormat("es-CO",{style:"currency",currency,maximumFractionDigits:0}).format(cents/100);
const label = (c:string) => c === "NEW" ? "Nuevo" : c === "USED" ? "Usado" : "Reacondicionado";
const faqs = [
  ["¿Qué garantía tiene este equipo?", "La garantía indicada en la ficha aplica al producto y se muestra antes de comprar."],
  ["¿Cómo se verifica el estado del equipo?", "Mostramos condición, batería cuando corresponde, capacidad, color, disponibilidad y especificaciones relevantes."],
  ["¿Está disponible para compra inmediata?", "La disponibilidad se consulta contra el inventario actual del catálogo antes de agregar el producto al carrito."],
  ["¿Puedo pedir ayuda antes de comprar?", "Sí. Puedes revisar nuestros servicios o contactar al equipo para resolver dudas sobre el dispositivo."],
] as const;

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params; const product=await getProductBySlug(slug); if(!product)return {title:"Producto no encontrado"}; const p=product.toPrimitives();
  return {title:p.seoTitle??`${p.name} | Ecommerce iPhone`,description:p.seoDescription??p.description,alternates:{canonical:`/iphone/${p.slug}`},openGraph:{title:p.name,description:p.description,type:"website",images:p.images[0]?[{url:p.images[0],alt:p.name}]:undefined}};
}

export default async function IphoneProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const product=await getProductBySlug(slug); if(!product)notFound(); const p=product.toPrimitives();
  const related=(await searchCatalog({brand:p.brand,page:1,pageSize:8})).items.filter((item)=>item.id!==p.id).slice(0,4);
  const jsonLd={"@context":"https://schema.org","@type":"Product",name:p.name,description:p.description,sku:p.id,brand:{"@type":"Brand",name:p.brand},image:p.images,offers:{"@type":"Offer",price:(p.priceInCents/100).toFixed(0),priceCurrency:p.currency,availability:p.stock>0?"https://schema.org/InStock":"https://schema.org/OutOfStock",url:`/iphone/${p.slug}`}};
  return <main className="store-shell product-detail">
    <header className="store-header"><Link href="/" className="brand-mark">Ecommerce iPhone</Link><nav aria-label="Principal"><Link href="/">Inicio</Link><Link href="/catalog">Catálogo</Link><Link href="/cart">Carrito</Link><Link href="/servicios">Servicios</Link></nav></header>
    <nav className="breadcrumbs" aria-label="Migas de pan"><Link href="/">Inicio</Link><span>/</span><Link href="/catalog">Catálogo</Link><span>/</span><span aria-current="page">{p.name}</span></nav>
    <div className="product-detail-grid">
      <div className="product-gallery" aria-label={`Galería de ${p.name}`}>
        {p.images.map((image,index)=><div className={index===0?"product-image large product-image-primary":"product-image-thumb"} key={image}><Image src={image} alt={index===0?`${p.name} principal`:`${p.name} vista ${index+1}`} width={900} height={900} priority={index===0} sizes={index===0?"(max-width: 800px) 100vw, 55vw":"96px"}/></div>)}
        {p.images.length===0&&<div className="product-image large"><span aria-hidden="true">{p.brand}</span></div>}
      </div>
      <section aria-labelledby="product-title"><p className="eyebrow">{p.brand}</p><h1 id="product-title">{p.name}</h1><p className="product-model">{p.model}</p><p className="product-description">{p.description}</p><div className="product-price">{money(p.priceInCents,p.currency)}</div>
        <div className="purchase-meta" role="status"><strong>{p.stock>0?"Disponible":"Agotado"}</strong><span>{p.stock>0?`${p.stock} unidades en inventario`:"Sin unidades disponibles"}</span></div>
        <dl className="specs"><div><dt>Condición</dt><dd>{label(p.condition)}</dd></div><div><dt>Garantía</dt><dd>{p.warrantyMonths} meses</dd></div>{p.batteryHealth!==undefined&&<div><dt>Salud de batería</dt><dd>{p.batteryHealth}%</dd></div>}{p.storageGb!==undefined&&<div><dt>Capacidad</dt><dd>{p.storageGb} GB</dd></div>}{p.color&&<div><dt>Color</dt><dd>{p.color}</dd></div>}</dl>
        <AddToCartButton productId={p.id} disabled={p.stock===0}/>
      </section>
    </div>
    <section className="detail-section" aria-labelledby="specs-title"><p className="eyebrow">Especificaciones</p><h2 id="specs-title">Todo lo que necesitas saber.</h2><dl className="specs spec-grid">{Object.entries(p.specs).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className="detail-section" aria-labelledby="faq-title"><p className="eyebrow">Preguntas frecuentes</p><h2 id="faq-title">Antes de comprar.</h2><div className="faq-list">{faqs.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    {related.length>0&&<section className="detail-section" aria-labelledby="related-title"><p className="eyebrow">También te puede interesar</p><h2 id="related-title">Otros equipos de {p.brand}.</h2><div className="related-grid">{related.map((item)=><Link href={`/iphone/${item.slug}`} className="product-card" key={item.id}><div className="product-image">{item.images[0]?<Image src={item.images[0]} alt={item.name} width={640} height={640} sizes="(max-width: 520px) 100vw, 25vw"/>:<span>{item.brand}</span>}</div><p className="eyebrow">{item.brand}</p><h3>{item.name}</h3><strong>{money(item.priceInCents,item.currency)}</strong></Link>)}</div></section>}
    <section className="detail-section product-trust" aria-label="Compra con confianza"><div><p className="eyebrow">Compra con confianza</p><h2>Información clara antes de pagar.</h2></div><p>Mostramos precio, inventario, condición, garantía y especificaciones desde el servidor para que la decisión no dependa de datos enviados por el navegador.</p></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/>
  </main>;
}
