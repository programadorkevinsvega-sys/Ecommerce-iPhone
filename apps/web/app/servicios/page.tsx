import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_CATALOG } from "../../../../modules/services/domain/ServiceRequest";

export const metadata: Metadata = { title: "Servicios para dispositivos", description: "Servicios legítimos de desbloqueo de operador, diagnóstico, reparación y configuración de dispositivos.", alternates: { canonical: "/servicios" } };

export default function ServicesPage() {
  return <main className="store-shell"><header className="store-header"><Link className="brand" href="/">Ecommerce iPhone</Link><nav><Link href="/catalog">Catálogo</Link><Link href="/cart">Carrito</Link></nav></header><section className="catalog-hero"><p className="eyebrow">Servicios</p><h1>Soporte técnico para tu dispositivo.</h1><p>Solicita un servicio legítimo con seguimiento, cotización y estados claros.</p><Link className="primary-button" href="/servicios/solicitar">Solicitar servicio</Link></section><section className="section"><div className="category-grid">{SERVICE_CATALOG.map(service => <article className="category-card" key={service.type}><h2>{service.name}</h2><p>{service.description}</p><Link href="/servicios/solicitar">Solicitar →</Link></article>)}</div></section></main>;
}
