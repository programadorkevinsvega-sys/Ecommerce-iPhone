"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

const emptyForm = {
  code: "", slug: "", name: "", description: "", imageUrl: "", category: "REPAIR",
  priceFromInCents: "", fixedPriceInCents: "", estimatedMinutes: "", warrantyDays: "",
  requiresDiagnosis: false, requiresApproval: true, quoteRequired: true, paymentRequired: true,
  technicianApprovalRequired: true, adminApprovalRequired: false, customerOwnershipProofRequired: false,
  enabled: true, compatibility: "", requirements: "",
};

type Service = Record<string, any>;

function money(value: unknown) { return value === undefined || value === null ? "" : String(value); }

export default function ServiceTypesPage() {
  const [items, setItems] = useState<Service[]>([]), [form, setForm] = useState(emptyForm), [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { const r = await fetch("/api/admin/service-types", { cache: "no-store" }); const b = await r.json(); if (!r.ok) throw new Error(b.error); setItems(b.items); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function edit(item: Service) {
    setEditing(item.code); setForm({ ...emptyForm, code: item.code, slug: item.slug, name: item.name, description: item.description, imageUrl: item.imageUrl ?? "", category: item.category,
      priceFromInCents: money(item.priceFromInCents), fixedPriceInCents: money(item.fixedPriceInCents), estimatedMinutes: money(item.estimatedMinutes), warrantyDays: money(item.warrantyDays),
      requiresDiagnosis: Boolean(item.requiresDiagnosis), requiresApproval: Boolean(item.requiresApproval), quoteRequired: Boolean(item.workflow?.quoteRequired), paymentRequired: Boolean(item.workflow?.paymentRequired),
      technicianApprovalRequired: Boolean(item.workflow?.technicianApprovalRequired), adminApprovalRequired: Boolean(item.workflow?.adminApprovalRequired), customerOwnershipProofRequired: Boolean(item.workflow?.customerOwnershipProofRequired),
      enabled: Boolean(item.enabled), compatibility: (item.compatibility ?? []).map((x: any) => `${x.brand}${x.model ? `|${x.model}` : ""}`).join("\n"), requirements: (item.requirements ?? []).map((x: any) => `${x.required ? "*" : ""}${x.description}`).join("\n") });
  }
  function reset() { setEditing(null); setForm(emptyForm); }
  function value(key: keyof typeof emptyForm) { return form[key]; }
  function set(key: keyof typeof emptyForm, next: string | boolean) { setForm((current) => ({ ...current, [key]: next })); }

  const compatibility = useMemo(() => form.compatibility.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [brand, model] = line.split("|", 2); return { brand: brand.trim(), ...(model?.trim() ? { model: model.trim() } : {}) }; }), [form.compatibility]);
  const requirements = useMemo(() => form.requirements.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => ({ description: line.startsWith("*") ? line.slice(1).trim() : line, required: line.startsWith("*") })), [form.requirements]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const workflow = { allowedStatuses: ["PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"], quoteRequired: form.quoteRequired, paymentRequired: form.paymentRequired, technicianApprovalRequired: form.technicianApprovalRequired, adminApprovalRequired: form.adminApprovalRequired, customerOwnershipProofRequired: form.customerOwnershipProofRequired };
    const payload: Record<string, unknown> = { code: form.code, slug: form.slug, name: form.name, description: form.description, category: form.category, workflow, enabled: form.enabled, requiresDiagnosis: form.requiresDiagnosis, requiresApproval: form.requiresApproval, compatibility, requirements, ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}) };
    for (const [field, key] of [["priceFromInCents", "priceFromInCents"], ["fixedPriceInCents", "fixedPriceInCents"], ["estimatedMinutes", "estimatedMinutes"], ["warrantyDays", "warrantyDays"]] as const) if (form[field]) payload[key] = Number(form[field]);
    try { const r = await fetch(editing ? `/api/admin/service-types/${encodeURIComponent(editing)}` : "/api/admin/service-types", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const b = await r.json(); if (!r.ok) throw new Error(b.error); reset(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  }

  async function archive(code: string) {
    if (!window.confirm("¿Archivar este servicio? Se conservará para el historial y dejará de estar disponible.")) return;
    setError("");
    try { const r = await fetch(`/api/admin/service-types/${encodeURIComponent(code)}`, { method: "DELETE" }); const b = await r.json(); if (!r.ok) throw new Error(b.error); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo archivar"); }
  }

  return <main style={{ padding: 28, maxWidth: 1500, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", marginBottom: 24 }}><div><h1 style={{ marginBottom: 6 }}>Catálogo de servicios</h1><p style={{ opacity: .7 }}>Servicios configurables para reparaciones, mantenimiento, diagnóstico y operaciones técnicas.</p></div><button type="button" onClick={reset}>Nuevo servicio</button></div>
    {error && <div role="alert" style={{ marginBottom: 18 }}>{error}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(360px,1fr)", gap: 24, alignItems: "start" }}>
      <section><div style={{ display: "grid", gap: 12 }}>{loading ? <p>Cargando catálogo…</p> : items.map((item) => <article key={item.code} style={{ border: "1px solid currentColor", borderRadius: 12, padding: 18, opacity: item.enabled ? 1 : .55 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}><div><strong>{item.name}</strong><div style={{ fontSize: 13, opacity: .7 }}>{item.code} · {item.slug} · {item.category}</div></div><span>{item.enabled ? "Activo" : "Archivado"}</span></div><p>{item.description}</p><div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}><span>Desde: {item.priceFromInCents != null ? `$${Number(item.priceFromInCents).toLocaleString("es-CO")}` : "—"}</span><span>Tiempo: {item.estimatedMinutes ?? "—"} min</span><span>Garantía: {item.warrantyDays ?? "—"} días</span><span>Compatibilidad: {item.compatibility?.length ?? 0}</span></div><div style={{ display: "flex", gap: 8, marginTop: 14 }}><button type="button" onClick={() => edit(item)}>Editar</button>{item.enabled && <button type="button" onClick={() => archive(item.code)}>Archivar</button>}</div></article>)}</div></section>
      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20 }}><h2>{editing ? "Editar servicio" : "Nuevo servicio"}</h2><form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        {(["code","slug","name","description","imageUrl","category","priceFromInCents","fixedPriceInCents","estimatedMinutes","warrantyDays"] as const).map((key) => <label key={key}>{key}<input value={String(value(key))} onChange={(e) => set(key, e.target.value)} required={key === "code" || key === "slug" || key === "name" || key === "description" || key === "category"} disabled={editing !== null && key === "code"} /></label>)}
        <label>Compatibilidad<div>Una por línea: marca|modelo (modelo opcional)</div><textarea rows={5} value={form.compatibility} onChange={(e) => set("compatibility", e.target.value)} /></label>
        <label>Requisitos<div>Uno por línea. Prefija con * los obligatorios.</div><textarea rows={5} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} /></label>
        <fieldset><legend>Flujo</legend>{([["requiresDiagnosis","Requiere diagnóstico"],["requiresApproval","Requiere aprobación"],["quoteRequired","Requiere cotización"],["paymentRequired","Requiere pago"],["technicianApprovalRequired","Requiere aprobación técnica"],["adminApprovalRequired","Requiere aprobación administrativa"],["customerOwnershipProofRequired","Requiere prueba de propiedad"]] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={Boolean(value(key))} onChange={(e) => set(key, e.target.checked)} /> {label}</label>)}</fieldset>
        <label><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Publicado</label>
        <div style={{ display: "flex", gap: 8 }}><button disabled={saving} type="submit">{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear servicio"}</button>{editing && <button type="button" onClick={reset}>Cancelar</button>}</div>
      </form></section>
    </div>
  </main>;
}
