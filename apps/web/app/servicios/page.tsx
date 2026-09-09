"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type ServiceType={code:string;name:string;description:string;category:string;workflow:{quoteRequired:boolean;paymentRequired:boolean}};

export default function ServicesPage(){
  const [services,setServices]=useState<ServiceType[]>([]);
  useEffect(()=>{fetch("/api/services").then(r=>r.json()).then(j=>setServices(j.services??[])).catch(()=>setServices([]));},[]);
  return <main className="store-shell"><header className="store-header"><Link className="brand" href="/">Ecommerce iPhone</Link><nav><Link href="/catalog">Catálogo</Link><Link href="/cart">Carrito</Link></nav></header><section className="catalog-hero"><p className="eyebrow">Servicios</p><h1>Soporte técnico configurable.</h1><p>El catálogo y sus requisitos se gestionan desde la configuración operativa del negocio.</p><Link className="primary-button" href="/servicios/solicitar">Solicitar servicio</Link></section><section className="section"><div className="category-grid">{services.map(service=><article className="category-card" key={service.code}><h2>{service.name}</h2><p>{service.description}</p><small>{service.workflow.quoteRequired?"Cotización":"Precio definido"}{service.workflow.paymentRequired?" · Pago requerido":""}</small><br/><Link href={`/servicios/solicitar?type=${encodeURIComponent(service.code)}`}>Solicitar →</Link></article>)}</div>{services.length===0&&<p>No hay servicios disponibles en este momento.</p>}</section></main>;
}
