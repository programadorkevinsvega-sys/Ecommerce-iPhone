"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Promotion = {
  id: string;
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minSubtotalInCents: number;
  maxUses?: number | null;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  active: number | boolean;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = { id: "", code: "", name: "", discountType: "PERCENT" as "PERCENT" | "FIXED", discountValue: "", minSubtotalInCents: "0", maxUses: "", startsAt: "", endsAt: "", active: true };

function toLocalInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function PromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/promotions", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as { items?: Promotion[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las promociones.");
      setItems(data.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las promociones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(item?: Promotion) {
    if (!item) {
      setForm(emptyForm);
      setEditing(false);
      return;
    }
    setEditing(true);
    setForm({ id: item.id, code: item.code, name: item.name, discountType: item.discountType, discountValue: String(item.discountValue), minSubtotalInCents: String(item.minSubtotalInCents), maxUses: item.maxUses == null ? "" : String(item.maxUses), startsAt: toLocalInput(item.startsAt), endsAt: toLocalInput(item.endsAt), active: Boolean(item.active) });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...(form.id ? { id: form.id } : {}), code: form.code, name: form.name, discountType: form.discountType, discountValue: Number(form.discountValue), minSubtotalInCents: Number(form.minSubtotalInCents), maxUses: form.maxUses === "" ? null : Number(form.maxUses), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), active: form.active };
      const response = await fetch("/api/admin/promotions", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar la promoción.");
      edit();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la promoción.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Promotion) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/promotions", { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: item.id, active: !Boolean(item.active) }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo actualizar el estado.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell active="promotions" kicker="Contenido comercial" title="Promociones" description="Gestiona códigos y reglas de descuento almacenadas en producción.">
      {error && <p className="admin-error" role="alert">{error}</p>}
      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Campaña" title={editing ? "Editar promoción" : "Nueva promoción"} actions={editing ? <button className="admin-button" type="button" onClick={() => edit()}>Nueva</button> : undefined} />
          <form className="admin-form" onSubmit={save}>
            <div className="form-grid">
              <label>Código<input required maxLength={64} value={form.code} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))} /></label>
              <label>Nombre<input required maxLength={200} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label>
              <label>Tipo<select value={form.discountType} onChange={(event) => setForm((value) => ({ ...value, discountType: event.target.value as "PERCENT" | "FIXED" }))}><option value="PERCENT">Porcentaje</option><option value="FIXED">Valor fijo (centavos)</option></select></label>
              <label>Descuento<input type="number" min="1" max={form.discountType === "PERCENT" ? 100 : undefined} value={form.discountValue} onChange={(event) => setForm((value) => ({ ...value, discountValue: event.target.value }))} /></label>
              <label>Mínimo subtotal (centavos)<input type="number" min="0" value={form.minSubtotalInCents} onChange={(event) => setForm((value) => ({ ...value, minSubtotalInCents: event.target.value }))} /></label>
              <label>Máximo de usos<input type="number" min="1" value={form.maxUses} onChange={(event) => setForm((value) => ({ ...value, maxUses: event.target.value }))} /></label>
              <label>Inicio<input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm((value) => ({ ...value, startsAt: event.target.value }))} /></label>
              <label>Fin<input required type="datetime-local" value={form.endsAt} onChange={(event) => setForm((value) => ({ ...value, endsAt: event.target.value }))} /></label>
            </div>
            <label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={(event) => setForm((value) => ({ ...value, active: event.target.checked }))} /> Activa</label>
            <button className="admin-button primary" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear promoción"}</button>
          </form>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionHeading kicker="Producción" title="Promociones registradas" meta={<span className="muted">{items.length} promociones</span>} />
          {loading ? (
            <AdminLoadingState label="Cargando promociones…" />
          ) : (
            <AdminTable
              headers={["Código", "Descuento", "Periodo", "Usos", "Estado", "Acción"]}
              empty={!items.length ? <AdminEmptyState title="No hay promociones registradas" /> : undefined}
            >
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.code}</strong><span className="table-subtext">{item.name}</span></td>
                  <td>{item.discountType === "PERCENT" ? item.discountValue + "%" : item.discountValue + " centavos"}</td>
                  <td>{new Date(item.startsAt).toLocaleString("es-CO")} → {new Date(item.endsAt).toLocaleString("es-CO")}</td>
                  <td>{item.usedCount}{item.maxUses != null ? " / " + item.maxUses : ""}</td>
                  <td>{Boolean(item.active) ? "Activa" : "Inactiva"}</td>
                  <td><button className="table-action" onClick={() => edit(item)}>Editar</button><button className="table-action" disabled={saving} onClick={() => void toggle(item)}>{Boolean(item.active) ? "Desactivar" : "Activar"}</button></td>
                </tr>
              ))}
            </AdminTable>
          )}
        </AdminPanel>
      </section>
    </AdminPageShell>
  );
}
