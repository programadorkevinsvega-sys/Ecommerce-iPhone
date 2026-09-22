"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Setting = { key: string; valueJson: string; sensitive: number | boolean; updatedBy?: string; updatedAt?: string };
const empty = { key: "", value: "{}", sensitive: false };

export default function SettingsPage() {
  const [items, setItems] = useState<Setting[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as { items?: Setting[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar la configuración.");
      setItems(data.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const value = JSON.parse(form.value);
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ key: form.key, value, sensitive: form.sensitive }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar la configuración.");
      setMessage("Configuración guardada.");
      setForm(empty);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "El valor debe ser JSON válido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell active="settings" kicker="Plataforma" title="Configuración" description="Valores operativos almacenados en D1. Los valores sensibles se muestran siempre redactados al consultarlos.">
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-notice" role="status">{message}</p>}
      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Configuración" title="Guardar valor" />
          <form className="admin-form" onSubmit={save}>
            <label>Clave<input required pattern="[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*" value={form.key} onChange={(event) => setForm((value) => ({ ...value, key: event.target.value.toLowerCase() }))} /></label>
            <label>Valor JSON<textarea required rows={12} value={form.value} onChange={(event) => setForm((value) => ({ ...value, value: event.target.value }))} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={form.sensitive} onChange={(event) => setForm((value) => ({ ...value, sensitive: event.target.checked }))} /> Marcar como sensible</label>
            <button className="admin-button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</button>
          </form>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionHeading kicker="Producción" title="Parámetros almacenados" meta={<span className="muted">{items.length} claves</span>} />
          {loading ? (
            <AdminLoadingState label="Cargando configuración…" />
          ) : (
            <AdminTable
              headers={["Clave", "Valor", "Sensible", "Actualizado"]}
              empty={!items.length ? <AdminEmptyState title="No hay parámetros configurados" /> : undefined}
            >
              {items.map((item) => (
                <tr key={item.key}>
                  <td><strong>{item.key}</strong></td>
                  <td><pre className="admin-json-inline">{item.valueJson}</pre></td>
                  <td>{Boolean(item.sensitive) ? "Sí" : "No"}</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString("es-CO") : "—"}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </AdminPanel>
      </section>
    </AdminPageShell>
  );
}
