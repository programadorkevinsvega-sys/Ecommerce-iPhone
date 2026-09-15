"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type ServiceType = {
  code: string;
  name: string;
  description: string;
  imageUrl?: string;
  category: string;
  workflow: { quoteRequired: boolean; paymentRequired: boolean };
  priceFromInCents?: number;
  fixedPriceInCents?: number;
  estimatedMinutes?: number;
  warrantyDays?: number;
  requiresDiagnosis?: boolean;
  requiresApproval?: boolean;
  compatibility: { brand: string; model?: string }[];
  requirements: { description: string; required: boolean }[];
};

const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value / 100);

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceType[]>([]);
  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((j) => setServices(j.services ?? []))
      .catch(() => setServices([]));
  }, []);
  return (
    <main className="store-shell services-page">
      <header className="store-header">
        <Link className="brand" href="/">
          Ecommerce iPhone
        </Link>
        <nav>
          <Link href="/">Inicio</Link>
          <Link href="/catalog">Catálogo</Link>
          <Link href="/servicios" aria-current="page">
            Servicios
          </Link>
          <Link href="/reparaciones">Consultar reparación</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/cart">Carrito</Link>
          <Link href="/cuenta">Mi cuenta</Link>
        </nav>
      </header>
      <section className="catalog-hero services-hero">
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
              {service.imageUrl && <img className="service-card-image" src={service.imageUrl} alt="" />}
              <div className="service-card-content">
                <p className="service-category">{service.category}</p>
                <h2>{service.name}</h2>
                <p>{service.description}</p>
                <div className="service-card-details">
                  {(service.fixedPriceInCents !== undefined || service.priceFromInCents !== undefined) && (
                    <span>{service.fixedPriceInCents !== undefined ? money(service.fixedPriceInCents) : `Desde ${money(service.priceFromInCents!)}`}</span>
                  )}
                  {service.estimatedMinutes !== undefined && <span>{service.estimatedMinutes} min estimados</span>}
                  {service.warrantyDays !== undefined && <span>Garantía: {service.warrantyDays} días</span>}
                </div>
                {(service.requiresDiagnosis || service.requiresApproval || service.requirements.length > 0) && (
                  <ul className="service-card-requirements">
                    {service.requiresDiagnosis && <li>Requiere diagnóstico</li>}
                    {service.requiresApproval && <li>Requiere tu aprobación</li>}
                    {service.requirements.map((item) => <li key={item.description}>{item.description}</li>)}
                  </ul>
                )}
                {service.compatibility.length > 0 && (
                  <p className="service-card-compatibility"><strong>Compatible con:</strong> {service.compatibility.map((item) => item.model ? `${item.brand} ${item.model}` : item.brand).join(", ")}</p>
                )}
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
