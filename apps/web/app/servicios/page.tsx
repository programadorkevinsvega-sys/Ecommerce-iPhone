import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Servicios para dispositivos", description: "Servicios legítimos de desbloqueo de operador, diagnóstico, reparación y configuración de dispositivos.", alternates: { canonical: "/servicios" } };

const services = ["Desbloqueo legítimo de operador", "Diagnóstico de dispositivo", "Reparación y configuración"];

export default function ServicesPage() {
  return <main className="store-shell"><header className="store-header"><span className="brand">Ecommerce iPhone</span><nav><Link href="/">Inicio</Link><Link href="/catalog">Catálogo</Link></nav></header><section className="catalog-hero"><p className="eyebrow">Servicios</p><h1>Soporte para tu dispositivo.</h1><p>Solicita servicios técnicos legítimos con seguimiento, cotización y estados claros.</p></section><section className="section"><div className="category-grid">{services.map((service) => <article className="category-card" key={service}><span>{service}</span><span>→</span></article>)}</div></section></main>;
}
