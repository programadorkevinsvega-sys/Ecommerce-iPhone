"use client";

import { StoreNavigation } from "../components/StoreHeader";

import Link from "next/link";
import { useEffect, useState } from "react";

type Portal = {
  customer: { firstName: string; lastName: string; email: string; phone: string | null; whatsapp: string | null; countryCode: string };
  addresses: Array<{ id: string; label: string; recipientName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; state: string; postalCode?: string; countryCode: string; isDefault: boolean }>;
  devices: Array<{ id: string; brand: string; model: string; serialLast4: string | null; imeiLast4: string | null; color: string | null }>;
  repairs: Array<{ id: string; orderNumber: string; status: string; device: { brand: string; model: string } }>;
  orders: Array<{ id: string; orderNumber: string; status: string; totalInCents: number; currency: string }>;
  warranties: Array<{ warrantyNumber: string; orderNumber: string; status: string; expiresAt: string }>;
  communications: Array<{ id: string; type: string; createdAt: string }>;
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);

const date = (value: string, withTime = false) =>
  new Intl.DateTimeFormat("es-CO", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(new Date(value));

const statusLabel = (value: string) => value.toLowerCase().replaceAll("_", " ");

export default function CuentaClient() {
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void fetch("/api/customer/portal", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setData(body);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Inicia sesión para continuar."))
      .finally(() => setBusy(false));
  }, []);

  async function logout() {
    await fetch("/api/customer/logout", { method: "POST" });
    window.location.href = "/cuenta/login";
  }

  if (busy) {
    return (
      <main className="account-page">
        <section className="account-loading"><div className="account-spinner" /><p>Cargando tu espacio personal…</p></section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="account-page">
        <section className="account-gate">
          <div className="account-gate-icon">↗</div>
          <p className="eyebrow">Área de cliente</p>
          <h1>Todo tu servicio, en un solo lugar.</h1>
          <p>{error || "Inicia sesión para consultar tus pedidos, dispositivos, reparaciones y garantías."}</p>
          <div className="button-row">
            <Link className="button primary" href="/cuenta/login">Iniciar sesión</Link>
            <Link className="button secondary" href="/cuenta/registro">Crear cuenta</Link>
          </div>
        </section>
      </main>
    );
  }

  const initials = (data.customer.firstName[0] || "") + (data.customer.lastName[0] || "");
  const defaultAddress = data.addresses.find(address => address.isDefault);

  return (
    <main className="account-page">
      <header className="account-topbar">
        <Link className="brand-mark" href="/">Ecommerce iPhone</Link>
        <StoreNavigation activeHref="/cuenta">
          <button className="link-button" onClick={() => void logout()}>Salir</button>
        </StoreNavigation>
      </header>

      <section className="account-hero">
        <div className="account-hero-copy">
          <span className="account-badge">Área de cliente</span>
          <p className="eyebrow">Mi cuenta</p>
          <h1>Hola, {data.customer.firstName}.</h1>
          <p>Gestiona tus compras, dispositivos y servicios técnicos desde un único espacio.</p>
          <div className="account-identity">
            <span className="account-avatar">{initials.toUpperCase()}</span>
            <div><strong>{data.customer.firstName} {data.customer.lastName}</strong><span>{data.customer.email}</span></div>
          </div>
        </div>
        <div className="account-hero-actions">
          <Link className="button light" href="/cuenta/perfil">Editar perfil</Link>
          <button className="button dark-outline" onClick={() => void logout()}>Cerrar sesión</button>
        </div>
      </section>

      <section className="account-stats">
        <article><span className="account-stat-icon">▣</span><div><small>Pedidos</small><strong>{data.orders.length}</strong></div></article>
        <article><span className="account-stat-icon">⌁</span><div><small>Reparaciones</small><strong>{data.repairs.length}</strong></div></article>
        <article><span className="account-stat-icon">◌</span><div><small>Dispositivos</small><strong>{data.devices.length}</strong></div></article>
        <article><span className="account-stat-icon">✓</span><div><small>Garantías</small><strong>{data.warranties.length}</strong></div></article>
      </section>

      <section className="account-layout">
        <aside className="account-sidebar">
          <div className="account-side-card">
            <p className="eyebrow">Acceso rápido</p>
            <Link href="/cuenta/perfil"><span>Perfil y contacto</span><b>→</b></Link>
            <Link href="/cuenta/direcciones"><span>Direcciones</span><b>→</b></Link>
            <Link href="/cuenta/dispositivos"><span>Mis dispositivos</span><b>→</b></Link>
            <Link href="/catalog"><span>Explorar catálogo</span><b>→</b></Link>
            <Link href="/servicios"><span>Servicios técnicos</span><b>→</b></Link>
          </div>

          <article className="account-side-card account-contact-card">
            <p className="eyebrow">Contacto</p>
            <strong>{data.customer.phone || "Teléfono no registrado"}</strong>
            <span>{data.customer.whatsapp ? "WhatsApp " + data.customer.whatsapp : "WhatsApp no registrado"}</span>
            <small>País · {data.customer.countryCode}</small>
          </article>

          <article className="account-side-card account-address-card">
            <p className="eyebrow">Dirección principal</p>
            {defaultAddress ? (
              <>
                <strong>{defaultAddress.label}</strong>
                <span>{defaultAddress.addressLine1}{defaultAddress.addressLine2 ? " · " + defaultAddress.addressLine2 : ""}</span>
                <small>{defaultAddress.city}, {defaultAddress.state}</small>
              </>
            ) : <span>Aún no tienes una dirección principal.</span>}
          </article>
        </aside>

        <div className="account-main">
          <section className="account-panel">
            <div className="account-panel-heading">
              <div><p className="eyebrow">Soporte técnico</p><h2>Tus reparaciones</h2></div>
              <Link href="/reparaciones">Consultar orden</Link>
            </div>
            {data.repairs.length ? (
              <div className="account-record-list">
                {data.repairs.slice(0, 4).map(repair => (
                  <article className="account-record" key={repair.id}>
                    <div className="account-record-mark">↗</div>
                    <div className="account-record-main"><strong>{repair.orderNumber}</strong><span>{repair.device.brand} {repair.device.model}</span></div>
                    <span className="account-status">{statusLabel(repair.status)}</span>
                  </article>
                ))}
              </div>
            ) : <div className="account-empty"><strong>Aún no tienes reparaciones.</strong><span>Cuando registres un equipo, podrás seguir aquí su avance.</span></div>}
          </section>

          <section className="account-two-column">
            <article className="account-panel">
              <div className="account-panel-heading"><div><p className="eyebrow">Tienda</p><h2>Últimos pedidos</h2></div><Link href="/catalog">Comprar</Link></div>
              {data.orders.length ? (
                <div className="account-compact-list">
                  {data.orders.slice(0, 4).map(order => <div className="account-compact-row" key={order.id}><div><strong>{order.orderNumber}</strong><span>{statusLabel(order.status)}</span></div><b>{money(order.totalInCents, order.currency)}</b></div>)}
                </div>
              ) : <div className="account-empty"><strong>No hay compras todavía.</strong><span>Descubre nuestros productos y accesorios.</span></div>}
            </article>

            <article className="account-panel">
              <div className="account-panel-heading"><div><p className="eyebrow">Equipos</p><h2>Mis dispositivos</h2></div><Link href="/cuenta/dispositivos">Ver todos</Link></div>
              {data.devices.length ? (
                <div className="account-compact-list">
                  {data.devices.slice(0, 4).map(device => <div className="account-compact-row" key={device.id}><div><strong>{device.brand} {device.model}</strong><span>{device.color || "Sin color registrado"}</span></div><b>{device.imeiLast4 ? "••••" + device.imeiLast4 : "—"}</b></div>)}
                </div>
              ) : <div className="account-empty"><strong>No hay dispositivos registrados.</strong><span>Los equipos se asociarán a tu cuenta durante la atención.</span></div>}
            </article>
          </section>

          <section className="account-panel">
            <div className="account-panel-heading"><div><p className="eyebrow">Protección</p><h2>Tus garantías</h2></div></div>
            {data.warranties.length ? (
              <div className="account-record-list">
                {data.warranties.slice(0, 4).map(warranty => (
                  <article className="account-record" key={warranty.warrantyNumber}>
                    <div className="account-record-mark success">✓</div>
                    <div className="account-record-main"><strong>{warranty.warrantyNumber}</strong><span>Orden {warranty.orderNumber} · vence {date(warranty.expiresAt)}</span></div>
                    <span className="account-status">{statusLabel(warranty.status)}</span>
                  </article>
                ))}
              </div>
            ) : <div className="account-empty"><strong>No hay garantías registradas.</strong><span>Cuando corresponda, aparecerán aquí con su fecha de vencimiento.</span></div>}
          </section>

          <section className="account-panel">
            <div className="account-panel-heading"><div><p className="eyebrow">Actividad</p><h2>Comunicaciones recientes</h2></div></div>
            {data.communications.length ? (
              <div className="account-compact-list">
                {data.communications.slice(0, 5).map(item => <div className="account-compact-row" key={item.id}><div><strong>{statusLabel(item.type)}</strong><span>Actualización de tu cuenta</span></div><b>{date(item.createdAt, true)}</b></div>)}
              </div>
            ) : <div className="account-empty"><strong>No hay comunicaciones recientes.</strong><span>Aquí aparecerán las novedades y actualizaciones de tu cuenta.</span></div>}
          </section>
        </div>
      </section>
    </main>
  );
}
