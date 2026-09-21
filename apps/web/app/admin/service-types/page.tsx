"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AdminSidebar from "../AdminSidebar";
import AdminLoadingState from "../AdminLoadingState";

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

  const compatibility = useMemo(() => form.compatibility.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [brand = "", model] = line.split("|", 2); return { brand: brand.trim(), ...(model?.trim() ? { model: model.trim() } : {}) }; }), [form.compatibility]);
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

  return (
    <main className="admin-shell">
      <AdminSidebar active="service-types" />
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Catálogo</p>
            <h1>Servicios ofrecidos</h1>
            <p>Configura servicios reales de reparación, diagnóstico y mantenimiento con sus reglas operativas.</p>
          </div>
        </header>

        {error && <p className="admin-error" role="alert">{error}</p>}

        <section className="admin-workspace admin-page-grid service-types-layout">
          <div className="admin-page-panel admin-page-table-panel">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">Catálogo</p>
                <h2>Servicios registrados</h2>
              </div>
              <div className="admin-toolbar-actions">
                <span className="muted">{items.length} servicios</span>
                <button className="admin-button primary" type="button" onClick={reset}>Nuevo servicio</button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Categoría</th>
                    <th>Precio / tiempo</th>
                    <th>Flujo</th>
                    <th>Estado</th>
                    <th className="align-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.code}>
                      <td>
                        <strong>{item.name}</strong>
                        <span className="table-subtext">{item.code} · {item.slug}</span>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        {item.fixedPriceInCents != null
                          ? `$${Number(item.fixedPriceInCents / 100).toLocaleString("es-CO")}`
                          : item.priceFromInCents != null
                            ? `Desde $${Number(item.priceFromInCents / 100).toLocaleString("es-CO")}`
                            : "Por definir"}
                        <span className="table-subtext">{item.estimatedMinutes ?? "—"} min · {item.warrantyDays ?? "—"} días garantía</span>
                      </td>
                      <td>
                        <span className="table-subtext">
                          {item.workflow?.quoteRequired ? "Cotización" : "Precio directo"} · {item.workflow?.paymentRequired ? "Pago" : "Sin pago previo"}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${item.enabled ? "success" : "muted-status"}`}>
                          {item.enabled ? "Publicado" : "Archivado"}
                        </span>
                      </td>
                      <td className="align-right">
                        <button className="table-action" type="button" onClick={() => edit(item)}>Editar</button>
                        {item.enabled && <button className="table-action danger" type="button" onClick={() => void archive(item.code)}>Archivar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length && !loading && (
                <div className="admin-empty">
                  <span>◇</span>
                  <h3>No hay servicios configurados</h3>
                  <p>Registra los servicios que ofrecerá el taller para que puedan aparecer en el flujo real.</p>
                </div>
              )}
              {loading && <AdminLoadingState label="Cargando catálogo…" />}
            </div>
          </div>

          <div className="admin-page-panel">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">Configuración</p>
                <h2>{editing ? "Editar servicio" : "Nuevo servicio"}</h2>
              </div>
              {editing && <button className="admin-button" type="button" onClick={reset}>Nuevo</button>}
            </div>

            <form className="admin-form" onSubmit={submit}>
              <div className="form-grid">
                <label>Código<input required maxLength={64} value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} disabled={editing !== null} /></label>
                <label>Slug<input required value={form.slug} onChange={(e) => set("slug", e.target.value)} /></label>
                <label>Nombre<input required maxLength={180} value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
                <label>Categoría<select value={form.category} onChange={(e) => set("category", e.target.value)}><option>DEVICE</option><option>NETWORK</option><option>SOFTWARE</option><option>REPAIR</option><option>OTHER</option></select></label>
                <label>Precio desde · centavos COP<input type="number" min="0" value={form.priceFromInCents} onChange={(e) => set("priceFromInCents", e.target.value)} /></label>
                <label>Precio fijo · centavos COP<input type="number" min="0" value={form.fixedPriceInCents} onChange={(e) => set("fixedPriceInCents", e.target.value)} /></label>
                <label>Tiempo estimado · minutos<input type="number" min="1" value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} /></label>
                <label>Garantía · días<input type="number" min="0" value={form.warrantyDays} onChange={(e) => set("warrantyDays", e.target.value)} /></label>
              </div>

              <label>Descripción<textarea required rows={4} maxLength={5000} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
              <label>Imagen · URL<input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="URL pública de imagen" /></label>

              <fieldset className="admin-category-picker">
                <legend>Flujo del servicio</legend>
                <div className="admin-check-grid">
                  {([
                    ["requiresDiagnosis", "Requiere diagnóstico"],
                    ["requiresApproval", "Requiere aprobación del cliente"],
                    ["quoteRequired", "Requiere cotización"],
                    ["paymentRequired", "Requiere pago"],
                    ["technicianApprovalRequired", "Requiere aprobación técnica"],
                    ["adminApprovalRequired", "Requiere aprobación administrativa"],
                    ["customerOwnershipProofRequired", "Requiere prueba de propiedad"],
                  ] as const).map(([key, label]) => (
                    <label className="checkbox-label" key={key}>
                      <input type="checkbox" checked={Boolean(value(key))} onChange={(e) => set(key, e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label>Compatibilidad <span className="form-help">Una por línea: Marca|Modelo.</span><textarea rows={4} value={form.compatibility} onChange={(e) => set("compatibility", e.target.value)} /></label>
              <label>Requisitos <span className="form-help">Prefija con * los obligatorios.</span><textarea rows={4} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} /></label>

              <label className="checkbox-label">
                <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
                Publicado para clientes
              </label>

              <div className="modal-actions">
                {editing && <button className="admin-button" type="button" onClick={reset}>Cancelar</button>}
                <button className="admin-button primary" disabled={saving} type="submit">
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear servicio"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
