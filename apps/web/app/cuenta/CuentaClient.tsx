"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Portal = {
  customer: { firstName: string; lastName: string; email: string; phone: string | null; whatsapp: string | null; countryCode: string };
  addresses: Array<{ id: string; label: string; recipientName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; state: string; postalCode?: string; countryCode: string; isDefault: boolean }>;
  devices: Array<{ id: string; brand: string; model: string; serialLast4: string | null; imeiLast4: string | null; color: string | null }>;
  repairs: Array<{ id: string; orderNumber: string; status: string; device: { brand: string; model: string } }>;
  orders: Array<{ id: string; orderNumber: string; status: string; totalInCents: number; currency: string }>;
  warranties: Array<{ warrantyNumber: string; orderNumber: string; status: string; expiresAt: string }>;
  communications: Array<{ id: string; type: string; createdAt: string }>;
};

const money = (value: number, currency: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);

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

  if (busy) return <main className="store-shell"><section className="empty-state"><p>Cargando tu cuenta…</p></section></main>;
  if (!data) return <main className="store-shell"><section className="empty-state"><h1>Tu cuenta de cliente</h1><p>{error}</p><div className="button-row"><Link className="button primary" href="/cuenta/login">Iniciar sesión</Link><Link className="button secondary" href="/cuenta/registro">Crear cuenta</Link></div></section></main>;

  return (
    <main className="store-shell">
      <header className="store-header"><Link className="brand-mark" href="/">Ecommerce iPhone</Link><nav><Link href="/catalog">Catálogo</Link><Link href="/servicios">Servicios</Link><button className="link-button" onClick={() => void logout()}>Salir</button></nav></header>
      <section className="catalog-hero"><p className="eyebrow">Mi cuenta</p><h1>Hola, {data.customer.firstName}.</h1><p>{data.customer.email} · {data.customer.countryCode}</p></section>

      <section className="account-grid">
        <article className="contact-card"><p className="eyebrow">Perfil</p><h2>{data.customer.firstName} {data.customer.lastName}</h2><p>{data.customer.phone ?? "Sin teléfono registrado"}</p><p>{data.customer.whatsapp ?? "Sin WhatsApp registrado"}</p><Link className="button secondary" href="/cuenta/perfil">Editar perfil</Link></article>
        <article className="contact-card"><p className="eyebrow">Direcciones</p><h2>{data.addresses.length}</h2>{data.addresses.slice(0, 2).map(address => <p key={address.id}>{address.label}: {address.city}, {address.state}</p>)}<Link className="button secondary" href="/cuenta/direcciones">Gestionar direcciones</Link></article>
        <article className="contact-card"><p className="eyebrow">Mis dispositivos</p><h2>{data.devices.length}</h2>{data.devices.slice(0, 3).map(device => <p key={device.id}>{device.brand} {device.model}{device.imeiLast4 ? ` · IMEI ••••${device.imeiLast4}` : ""}</p>)}<Link className="button secondary" href="/cuenta/dispositivos">Gestionar dispositivos</Link></article>
      </section>

      <section className="section"><div className="section-heading"><div><p className="eyebrow">Reparaciones</p><h2>Seguimiento de tus equipos.</h2></div><Link className="button secondary" href="/reparaciones">Consultar una orden</Link></div><div className="account-list">{data.repairs.length ? data.repairs.map(repair => <article className="account-row" key={repair.id}><div><strong>{repair.orderNumber}</strong><p>{repair.device.brand} {repair.device.model}</p></div><span>{repair.status}</span></article>) : <p className="empty-state">Todavía no tienes reparaciones asociadas.</p>}</div></section>

      <section className="section"><div className="section-heading"><div><p className="eyebrow">Compras</p><h2>Historial de pedidos.</h2></div><Link className="button secondary" href="/catalog">Ver catálogo</Link></div><div className="account-list">{data.orders.length ? data.orders.map(order => <article className="account-row" key={order.id}><div><strong>{order.orderNumber}</strong><p>{order.status}</p></div><span>{money(order.totalInCents, order.currency)}</span></article>) : <p className="empty-state">Todavía no tienes compras.</p>}</div></section>

      <section className="section"><p className="eyebrow">Garantías</p><div className="account-list">{data.warranties.length ? data.warranties.map(warranty => <article className="account-row" key={warranty.warrantyNumber}><div><strong>{warranty.warrantyNumber}</strong><p>Orden {warranty.orderNumber}</p></div><span>{warranty.status} · {new Date(warranty.expiresAt).toLocaleDateString("es-CO")}</span></article>) : <p className="empty-state">No hay garantías registradas.</p>}</div></section>

      <section className="section"><div className="section-heading"><div><p className="eyebrow">Comunicaciones</p><h2>Historial de comunicaciones.</h2></div></div><div className="account-list">{data.communications.length ? data.communications.map(item => <article className="account-row" key={item.id}><div><strong>{item.type}</strong><p>Actualización asociada a tu cuenta</p></div><span>{new Date(item.createdAt).toLocaleString("es-CO")}</span></article>) : <p className="empty-state">Todavía no tienes comunicaciones registradas.</p>}</div></section>
    </main>
  );
}
