"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type CmsPage = { id: string; slug: string; title: string; content: string; seoTitle?: string; seoDescription?: string; canonicalUrl?: string; active: number | boolean; updatedAt?: string };
const empty = { id: "", slug: "", title: "", content: "", seoTitle: "", seoDescription: "", canonicalUrl: "", active: true };

export default function CmsPage() {
  const [items, setItems] = useState<CmsPage[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/cms", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as { items?: CmsPage[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el CMS.");
      setItems(data.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el CMS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(item?: CmsPage) {
    if (!item) {
      setForm(empty);
      setEditing(false);
      return;
    }
    setEditing(true);
    setForm({ id: item.id, slug: item.slug, title: item.title, content: item.content, seoTitle: item.seoTitle ?? "", seoDescription: item.seoDescription ?? "", canonicalUrl: item.canonicalUrl ?? "", active: Boolean(item.active) });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...(form.id ? { id: form.id } : {}), slug: form.slug, title: form.title, content: form.content, seoTitle: form.seoTitle || undefined, seoDescription: form.seoDescription || undefined, canonicalUrl: form.canonicalUrl || undefined, active: form.active };
      const response = await fetch("/api/admin/cms", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar la página.");
      edit();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la página.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: CmsPage) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/cms", { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: item.id, active: !Boolean(item.active) }) });
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
    <AdminPageShell active="cms" kicker="Contenido" title="CMS" description="Gestiona páginas de contenido reales; el carrusel de inicio continúa disponible como editor específico.">
      {error && <p className="admin-error" role="alert">{error}</p>}
      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Editor" title={editing ? "Editar página" : "Nueva página"} actions={editing ? <button className="admin-button" type="button" onClick={() => edit()}>Nueva</button> : undefined} />
          <form className="admin-form" onSubmit={save}>
            <label>Slug<input required maxLength={120} value={form.slug} onChange={(event) => setForm((value) => ({ ...value, slug: event.target.value }))} /></label>
            <label>Título<input required maxLength={200} value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label>
            <label>Contenido<textarea required rows={14} value={form.content} onChange={(event) => setForm((value) => ({ ...value, content: event.target.value }))} /></label>
            <label>SEO title<input value={form.seoTitle} onChange={(event) => setForm((value) => ({ ...value, seoTitle: event.target.value }))} /></label>
            <label>SEO description<textarea rows={3} value={form.seoDescription} onChange={(event) => setForm((value) => ({ ...value, seoDescription: event.target.value }))} /></label>
            <label>Canonical URL<input type="url" value={form.canonicalUrl} onChange={(event) => setForm((value) => ({ ...value, canonicalUrl: event.target.value }))} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={(event) => setForm((value) => ({ ...value, active: event.target.checked }))} /> Activa</label>
            <button className="admin-button primary" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear página"}</button>
          </form>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionHeading kicker="Contenido" title="Páginas registradas" meta={<span className="muted">{items.length} páginas</span>} />
          {loading ? (
            <AdminLoadingState label="Cargando CMS…" />
          ) : (
            <AdminTable headers={["Slug", "Título", "Estado", "Actualizado", "Acciones"]} empty={!items.length ? <AdminEmptyState title="No hay páginas CMS" /> : undefined}>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.slug}</td>
                  <td>{item.title}</td>
                  <td>{Boolean(item.active) ? "Activa" : "Inactiva"}</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString("es-CO") : "—"}</td>
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
