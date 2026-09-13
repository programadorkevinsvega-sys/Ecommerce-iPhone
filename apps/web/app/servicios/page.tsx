"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type ServiceType = {
  code: string;
  name: string;
  description: string;
  category: string;
  workflow: { quoteRequired: boolean; paymentRequired: boolean };
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceType[]>([]);
  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((j) => setServices(j.services ?? []))
      .catch(() => setServices([]));
  }, []);
  return (
    <main className="store-shell">
      <header className="store-header">
        <Link className="brand" href="/">
          Ecommerce iPhone
        </Link>
        <nav>
          <Link href="/">Inicio</Link>
          <Link href="/catalog">Catálogo</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/cart">Carrito</Link>
        </nav>
      </header>
      <section className="catalog-hero">
        <p className="eyebrow">Servicios</p>
        <h1>Soporte técnico configurable.</h1>
        <p>
          Consulta los servicios publicados por la tienda y envía tu solicitud con los datos de tu
          equipo.
        </p>
      </section>
      <section className="section">
        <div className="services-grid">
          {services.map((service) => (
            <article className="service-card" key={service.code}>
              <div className="service-card-content">
                <p className="service-category">{service.category}</p>
                <h2>{service.name}</h2>
                <p>{service.description}</p>
              </div>
              <div className="service-card-footer">
                <span>
                  {service.workflow.quoteRequired ? "Cotización" : "Precio definido"}
                  {service.workflow.paymentRequired ? " · Pago requerido" : ""}
                </span>
                <Link
                  className="service-card-link"
                  href={`/servicios/solicitar?type=${encodeURIComponent(service.code)}`}
                >
                  Solicitar <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
        {services.length === 0 && (
          <div className="empty-state">
            <h2>No hay servicios publicados</h2>
            <p>El catálogo se encuentra vacío en este momento.</p>
          </div>
        )}
        <aside className="service-banner">
          <div>
            <p className="eyebrow">¿No encuentras tu servicio?</p>
            <h2>Cuéntanos qué necesitas.</h2>
            <p>Envía una solicitud personalizada y nuestro equipo revisará tu caso.</p>
          </div>
          <Link className="button secondary service-banner-action" href="/servicios/solicitar">
            Crear solicitud <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </section>
    </main>
  );
}
