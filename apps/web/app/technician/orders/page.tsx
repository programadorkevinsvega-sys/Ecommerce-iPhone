"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import TechnicianHeader from "../TechnicianHeader";

type Order = { id: string; orderNumber: string; status: string; customerDeviceId?: string; problemReported: string; device: { brand: string; model: string }; diagnosisSummary?: string; workSummary?: string };
const statuses = ["DIAGNOSING", "WAITING_PART", "IN_REPAIR", "QUALITY_CONTROL"] as const;
const labels: Record<string, string> = { DIAGNOSING: "Diagnóstico", WAITING_PART: "Esperando repuesto", IN_REPAIR: "En reparación", QUALITY_CONTROL: "Control de calidad" };

export default function TechnicianOrders() {
  const [orders, setOrders] = useState<Order[]>([]); const [selected, setSelected] = useState<Order | null>(null);
  const [diagnosis, setDiagnosis] = useState(""); const [work, setWork] = useState(""); const [message, setMessage] = useState(""); const [stage, setStage] = useState("DIAGNOSIS");

  async function load() {
    const response = await fetch("/api/technician/orders", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/technician/login"; return; }
    if (response.ok) { const data = await response.json() as { items?: Order[] }; setOrders(data.items ?? []); }
  }
  useEffect(() => { void load(); }, []);
  function open(order: Order) { setSelected(order); setDiagnosis(order.diagnosisSummary ?? ""); setWork(order.workSummary ?? ""); setMessage(""); }
  async function patch(body: Record<string, unknown>, notice: string) {
    if (!selected) return;
    const response = await fetch("/api/technician/orders/" + selected.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const data = await response.json() as { order?: Order; error?: string };
    setMessage(response.ok ? notice : data.error ?? "No se pudo guardar.");
    if (response.ok && data.order) { setSelected(data.order); await load(); }
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !event.target.files?.[0]) return;
    const form = new FormData(); form.set("file", event.target.files[0]);
    const response = await fetch("/api/technician/orders/" + selected.id + "/media?stage=" + stage, { method: "POST", body: form, cache: "no-store" });
    setMessage(response.ok ? "Evidencia guardada." : "No se pudo guardar la evidencia.");
  }

  return <main className="technician-shell">
    <TechnicianHeader />
    <section className="technician-page-head"><div><p className="eyebrow">Operación</p><h1>Mis órdenes.</h1><p>Solo aparecen órdenes asignadas a tu identidad técnica.</p></div><span className="technician-count">{orders.length} asignadas</span></section>
    <section className="technician-orders-layout">
      <div className="technician-card technician-order-list"><div className="technician-section-head"><div><p className="eyebrow">Asignaciones</p><h2>Órdenes</h2></div></div>
        {orders.map((order) => <button className={selected?.id === order.id ? "technician-order-item active" : "technician-order-item"} key={order.id} onClick={() => open(order)} type="button"><span><strong>{order.orderNumber}</strong><small>{order.device.brand} {order.device.model}</small></span><em>{labels[order.status] ?? order.status}</em></button>)}
        {!orders.length && <div className="technician-empty"><strong>No hay órdenes asignadas.</strong><span>Administración debe asignarte una orden para comenzar.</span></div>}
      </div>
      {selected ? <article className="technician-card technician-order-detail">
        <div className="technician-section-head"><div><p className="eyebrow">Orden {selected.orderNumber}</p><h2>{selected.device.brand} {selected.device.model}</h2></div><button className="button secondary" type="button" onClick={() => setSelected(null)}>Cerrar</button></div>
        <div className="technician-order-context"><span>Problema reportado</span><p>{selected.problemReported}</p></div>
        <div className="technician-form">
          <label>Estado<select value={selected.status} onChange={(event) => void patch({ status: event.target.value }, "Estado actualizado.")}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Diagnóstico técnico<textarea rows={6} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
          <label>Trabajo realizado<textarea rows={6} value={work} onChange={(event) => setWork(event.target.value)} /></label>
          {message && <p className="technician-form-note" role="status">{message}</p>}
          <button className="button primary" type="button" onClick={() => void patch({ diagnosisSummary: diagnosis, workSummary: work }, "Ficha técnica guardada.")}>Guardar avance</button>
        </div>
        <div className="technician-evidence"><div><p className="eyebrow">Evidencia</p><h3>Documentar esta etapa</h3><p>Adjunta fotografías reales del estado del equipo y selecciona la etapa correspondiente.</p></div><div className="technician-evidence-controls"><select value={stage} onChange={(event) => setStage(event.target.value)}><option>RECEPTION</option><option>DIAGNOSIS</option><option>REPAIR</option><option>QUALITY_CONTROL</option></select><label className="button secondary">Subir imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event)} /></label></div></div>
        {selected.customerDeviceId ? <p className="technician-inline-info">Equipo enlazado al dispositivo del cliente.</p> : <p className="technician-inline-info">Registra el equipo desde <Link href="/technician/devices">Dispositivos</Link>.</p>}
      </article> : <article className="technician-card technician-order-placeholder"><span className="technician-placeholder-icon">↗</span><p className="eyebrow">Selecciona una orden</p><h2>Tu ficha técnica aparecerá aquí.</h2><p>Podrás actualizar el diagnóstico, trabajo realizado, estado y evidencias de reparación.</p></article>}
    </section>
  </main>;
}