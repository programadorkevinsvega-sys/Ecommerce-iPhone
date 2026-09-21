"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import TechnicianHeader from "./TechnicianHeader";

type Technician = { firstName: string; lastName: string; email: string };
type Order = { id: string; orderNumber: string; status: string; problemReported: string; device: { brand: string; model: string } };
const statusLabel: Record<string, string> = { DIAGNOSING: "Diagnóstico", WAITING_PART: "Esperando repuesto", IN_REPAIR: "En reparación", QUALITY_CONTROL: "Control de calidad", READY: "Listo" };

export default function TechnicianHome() {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const session = await fetch("/api/technician/auth/session", { cache: "no-store" });
        const sessionData = await session.json() as { authenticated: boolean; technician: Technician | null };
        if (!session.ok || !sessionData.authenticated) { window.location.href = "/technician/login"; return; }
        setTechnician(sessionData.technician);
        const response = await fetch("/api/technician/orders", { cache: "no-store", credentials: "same-origin" });
        if (response.status === 401) { window.location.href = "/technician/login"; return; }
        const data = await response.json() as { items?: Order[]; error?: string };
        if (!response.ok) { setError(data.error ?? "No se pudieron cargar las órdenes."); return; }
        setOrders(data.items ?? []);
      } catch { setError("No se pudo cargar el espacio técnico."); } finally { setLoading(false); }
    })();
  }, []);

  const counts = orders.reduce((acc, order) => {
    if (order.status === "DIAGNOSING") acc.diagnosis += 1;
    if (order.status === "IN_REPAIR") acc.repair += 1;
    if (order.status === "QUALITY_CONTROL") acc.quality += 1;
    return acc;
  }, { diagnosis: 0, repair: 0, quality: 0 });

  return (
    <main className="technician-shell">
      <TechnicianHeader firstName={technician?.firstName} email={technician?.email} />
      <section className="technician-page-head"><div><p className="eyebrow">Espacio de trabajo</p><h1>Hola{technician ? ", " + technician.firstName : ""}.</h1><p>Gestiona tus órdenes, registra equipos y documenta cada etapa técnica desde un solo lugar.</p></div><Link href="/technician/orders" className="button primary">Abrir órdenes</Link></section>
      {error && <div className="technician-alert" role="alert">{error}</div>}
      <section className="technician-stats" aria-label="Resumen operativo">
        <article><span>Órdenes asignadas</span><strong>{loading ? "—" : orders.length}</strong><small>Asignadas a tu identidad</small></article>
        <article><span>Diagnóstico</span><strong>{loading ? "—" : counts.diagnosis}</strong><small>En evaluación técnica</small></article>
        <article><span>En reparación</span><strong>{loading ? "—" : counts.repair}</strong><small>Trabajo activo</small></article>
        <article><span>Control de calidad</span><strong>{loading ? "—" : counts.quality}</strong><small>Antes de entregar</small></article>
      </section>
      <section className="technician-dashboard-grid">
        <article className="technician-card technician-card-dark"><div><p className="eyebrow">Operación</p><h2>Tu flujo técnico.</h2><p>Abre una orden, actualiza el diagnóstico, registra el trabajo realizado y adjunta evidencia fotográfica por etapa.</p></div><div className="technician-card-actions"><Link href="/technician/orders" className="button light">Ver órdenes</Link><Link href="/technician/devices" className="button dark-outline">Registrar dispositivo</Link></div></article>
        <article className="technician-card"><p className="eyebrow">Cuenta técnica</p><div className="technician-identity"><span className="technician-avatar">{(technician?.firstName?.[0] ?? "T") + (technician?.lastName?.[0] ?? "")}</span><div><h2>{technician ? technician.firstName + " " + technician.lastName : "Técnico"}</h2><p>{technician?.email ?? "Sesión técnica activa"}</p></div></div><div className="technician-capability-list"><span>✓ Órdenes asignadas</span><span>✓ Diagnóstico y ficha técnica</span><span>✓ Evidencia de reparación</span><span>✓ Perfil propio</span></div><Link href="/technician/profile" className="text-link">Gestionar perfil →</Link></article>
      </section>
      <section className="technician-card"><div className="technician-section-head"><div><p className="eyebrow">Actividad</p><h2>Últimas órdenes asignadas</h2></div><Link href="/technician/orders" className="text-link">Ver todas →</Link></div>
        {orders.length === 0 ? <div className="technician-empty"><strong>No hay órdenes asignadas.</strong><span>Cuando Administración te asigne una orden aparecerá aquí.</span></div> : <div className="technician-order-preview">{orders.slice(0, 5).map((order) => <Link href="/technician/orders" className="technician-order-row" key={order.id}><div><strong>{order.orderNumber}</strong><span>{order.device.brand} {order.device.model}</span></div><div><span className="technician-status">{statusLabel[order.status] ?? order.status}</span><small>{order.problemReported}</small></div></Link>)}</div>}
      </section>
    </main>
  );
}