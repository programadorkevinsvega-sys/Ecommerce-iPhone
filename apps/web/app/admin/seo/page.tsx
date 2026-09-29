"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Redirect = {
  id: string;
  sourcePath: string;
  targetUrl?: string;
  statusCode: 301 | 410;
  active: boolean;
  updatedAt: string;
};

type RouteOverride = {
  id: string;
  path: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  indexable: boolean;
  ogImageUrl?: string;
  updatedAt: string;
};

const emptyRedirect = { id: "", sourcePath: "", targetUrl: "", statusCode: 301 as 301 | 410, active: true };
const emptyRoute = { id: "", path: "", seoTitle: "", seoDescription: "", canonicalUrl: "", indexable: true, ogImageUrl: "" };

export default function SeoAdminPage() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [routes, setRoutes] = useState<RouteOverride[]>([]);
  const [redirect, setRedirect] = useState(emptyRedirect);
  const [route, setRoute] = useState(emptyRoute);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/seo", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as { redirects?: Redirect[]; routes?: RouteOverride[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar SEO.");
      setRedirects(data.redirects ?? []);
      setRoutes(data.routes ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar SEO.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveRedirect(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        kind: "redirect",
        ...(redirect.id ? { id: redirect.id } : {}),
        sourcePath: redirect.sourcePath,
        ...(redirect.statusCode === 301 ? { targetUrl: redirect.targetUrl } : {}),
        statusCode: redirect.statusCode,
        active: redirect.active,
      };
      const response = await fetch("/api/admin/seo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el redirect.");
      setRedirect(emptyRedirect);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el redirect.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoute(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        kind: "route",
        ...(route.id ? { id: route.id } : {}),
        path: route.path,
        seoTitle: route.seoTitle || undefined,
        seoDescription: route.seoDescription || undefined,
        canonicalUrl: route.canonicalUrl || undefined,
        indexable: route.indexable,
        ogImageUrl: route.ogImageUrl || undefined,
      };
      const response = await fetch("/api/admin/seo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar la configuración SEO.");
      setRoute(emptyRoute);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la configuración SEO.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell active="seo" kicker="Marketing técnico" title="SEO" description="Gestiona overrides SEO y redirects reales. Las URLs públicas siguen dependiendo de datos y contenido publicados.">
      {error && <p className="admin-error" role="alert">{error}</p>}
      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Redirect manager" title="Nuevo redirect" />
          <form className="admin-form" onSubmit={saveRedirect}>
            <label>Ruta origen<input required maxLength={2048} value={redirect.sourcePath} onChange={(event) => setRedirect((value) => ({ ...value, sourcePath: event.target.value }))} placeholder="/ruta-antigua" /></label>
            <label>Código<select value={redirect.statusCode} onChange={(event) => setRedirect((value) => ({ ...value, statusCode: Number(event.target.value) as 301 | 410 }))}><option value={301}>301 permanente</option><option value={410}>410 Gone</option></select></label>
            {redirect.statusCode === 301 && <label>Destino<input required type="url" value={redirect.targetUrl} onChange={(event) => setRedirect((value) => ({ ...value, targetUrl: event.target.value }))} placeholder="https://iphone.jnmtortas.com/nueva-ruta" /></label>}
            <label className="checkbox-label"><input type="checkbox" checked={redirect.active} onChange={(event) => setRedirect((value) => ({ ...value, active: event.target.checked }))} /> Activo</label>
            <button className="admin-button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar redirect"}</button>
          </form>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionHeading kicker="Metadata" title="Override de ruta" />
          <form className="admin-form" onSubmit={saveRoute}>
            <label>Ruta<input required maxLength={2048} value={route.path} onChange={(event) => setRoute((value) => ({ ...value, path: event.target.value }))} placeholder="/catalog" /></label>
            <label>SEO title<input maxLength={180} value={route.seoTitle} onChange={(event) => setRoute((value) => ({ ...value, seoTitle: event.target.value }))} /></label>
            <label>SEO description<textarea rows={3} maxLength={320} value={route.seoDescription} onChange={(event) => setRoute((value) => ({ ...value, seoDescription: event.target.value }))} /></label>
            <label>Canonical URL<input type="url" value={route.canonicalUrl} onChange={(event) => setRoute((value) => ({ ...value, canonicalUrl: event.target.value }))} /></label>
            <label>OG image<input type="url" value={route.ogImageUrl} onChange={(event) => setRoute((value) => ({ ...value, ogImageUrl: event.target.value }))} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={route.indexable} onChange={(event) => setRoute((value) => ({ ...value, indexable: event.target.checked }))} /> Indexable</label>
            <button className="admin-button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar SEO"}</button>
          </form>
        </AdminPanel>
      </section>

      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Redirects" title="Redirects registrados" meta={<span className="muted">{redirects.length}</span>} />
          {loading ? <AdminLoadingState label="Cargando redirects…" /> : (
            <AdminTable headers={["Origen", "Destino", "Código", "Estado", "Actualizado"]} empty={!redirects.length ? <AdminEmptyState title="No hay redirects" /> : undefined}>
              {redirects.map((item) => (
                <tr key={item.id}>
                  <td>{item.sourcePath}</td>
                  <td>{item.targetUrl ?? "—"}</td>
                  <td>{item.statusCode}</td>
                  <td>{item.active ? "Activo" : "Inactivo"}</td>
                  <td>{new Date(item.updatedAt).toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </AdminPanel>

        <AdminPanel>
          <AdminSectionHeading kicker="Overrides" title="Rutas SEO" meta={<span className="muted">{routes.length}</span>} />
          {loading ? <AdminLoadingState label="Cargando overrides…" /> : (
            <AdminTable headers={["Ruta", "Title", "Index", "Canonical", "Actualizado"]} empty={!routes.length ? <AdminEmptyState title="No hay overrides" /> : undefined}>
              {routes.map((item) => (
                <tr key={item.id}>
                  <td>{item.path}</td>
                  <td>{item.seoTitle ?? "—"}</td>
                  <td>{item.indexable ? "Sí" : "No"}</td>
                  <td>{item.canonicalUrl ?? "Automática"}</td>
                  <td>{new Date(item.updatedAt).toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </AdminPanel>
      </section>
    </AdminPageShell>
  );
}
