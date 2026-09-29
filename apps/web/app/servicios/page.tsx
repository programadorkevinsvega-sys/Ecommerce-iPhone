import type { Metadata } from "next";
import Image from "next/image";
import StoreHeader from "../components/StoreHeader";
import Link from "next/link";
import { listPublicServices } from "../../lib/services";
import { publicMetadataWithOverrides } from "../../lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return publicMetadataWithOverrides({
    title: "Servicios técnicos | Ecommerce iPhone",
    description: "Consulta servicios técnicos publicados, precios, requisitos, compatibilidad y solicitudes.",
    path: "/servicios",
  });
}

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value / 100);

export default async function ServicesPage() {
  const services = await listPublicServices();
  return (
    <main className="store-shell services-page">
      <StoreHeader activeHref="/servicios" />
      <section className="catalog-hero services-hero">
        <p className="eyebrow">Servicios</p>
        <h1>Soporte técnico configurable.</h1>
        <p>Consulta los servicios publicados por la tienda y envía tu solicitud con los datos de tu equipo.</p>
      </section>
      <section className="section">
        <div className="services-grid">
          {services.map((service) => {
            const p = service.toPrimitives();
            return (
              <article className="service-card" key={p.code}>
                {p.imageUrl && (
                  <Image
                    className="service-card-image"
                    src={p.imageUrl}
                    alt={p.name}
                    width={640}
                    height={260}
                    sizes="(max-width: 620px) 100vw, (max-width: 1050px) 50vw, 25vw"
                    unoptimized={p.imageUrl.startsWith("/api/media/")}
                  />
                )}
                <div className="service-card-content">
                  <p className="service-category">{p.category}</p>
                  <h2>{p.name}</h2>
                  <p>{p.description}</p>
                  <div className="service-card-details">
                    {(p.fixedPriceInCents !== undefined || p.priceFromInCents !== undefined) && (
                      <span>
                        {p.fixedPriceInCents !== undefined
                          ? money(p.fixedPriceInCents)
                          : "Desde " + money(p.priceFromInCents as number)}
                      </span>
                    )}
                    {p.estimatedMinutes !== undefined && <span>{p.estimatedMinutes} min estimados</span>}
                    {p.warrantyDays !== undefined && <span>Garantía: {p.warrantyDays} días</span>}
                  </div>
                  {(p.requiresDiagnosis || p.requiresApproval || (p.requirements?.length ?? 0) > 0) && (
                    <ul className="service-card-requirements">
                      {p.requiresDiagnosis && <li>Requiere diagnóstico</li>}
                      {p.requiresApproval && <li>Requiere tu aprobación</li>}
                      {(p.requirements ?? []).map((item) => <li key={item.description}>{item.description}</li>)}
                    </ul>
                  )}
                  {(p.compatibility?.length ?? 0) > 0 && (
                    <p className="service-card-compatibility">
                      <strong>Compatible con:</strong>{" "}
                      {(p.compatibility ?? []).map((item) => item.model ? item.brand + " " + item.model : item.brand).join(", ")}
                    </p>
                  )}
                </div>
                <div className="service-card-footer">
                  <span>
                    {p.workflow.quoteRequired ? "Cotización" : "Precio definido"}
                    {p.workflow.paymentRequired ? " · Pago requerido" : ""}
                  </span>
                  <Link className="service-card-link" href={"/servicios/solicitar?type=" + encodeURIComponent(p.code)}>
                    Solicitar <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
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
