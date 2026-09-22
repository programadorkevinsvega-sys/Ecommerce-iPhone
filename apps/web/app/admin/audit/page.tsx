"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "../AdminSidebar";
import AdminLoadingState from "../AdminLoadingState";

type AuditItem = {
  id: string; admin_user_id?: string; action: string; resource_type?: string; resource_id?: string;
  payload_json?: string; created_at: string;
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [adminUserId, setAdminUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextOffset = offset) {
    setLoading(true); setError("");
    const params = new URLSearchParams({ limit: "50", offset: String(nextOffset) });
    for (const [key, value] of Object.entries({ action, resourceType, adminUserId, from, to })) if (value) params.set(key, value);
    try {
      const response = await fetch(`/api/admin/audit?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json() as { items?: AuditItem[]; total?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar la auditoría.");
      setItems(data.items ?? []); setTotal(data.total ?? 0); setOffset(nextOffset);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cargar la auditoría."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(0); }, []);

  return (
    <main className="admin-shell"><AdminSidebar active="audit" /><section className="admin-content">
      <header className="admin-topbar"><div><p className="admin-kicker">Seguridad</p><h1>Auditoría</h1><p>Registro real de acciones administrativas y cambios sobre recursos.</p></div></header>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <section className="admin-workspace admin-page-panel">
        <div className="admin-toolbar">
          <label>Acción<input value={action} onChange={(e) => setAction(e.target.value)} maxLength={120} /></label>
          <label>Recurso<input value={resourceType} onChange={(e) => setResourceType(e.target.value)} maxLength={80} /></label>
          <label>Admin ID<input value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)} maxLength={128} /></label>
          <label>Desde<input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Hasta<input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="admin-button" type="button" onClick={() => void load(0)}>Filtrar</button>
        </div>
        {loading ? <AdminLoadingState label="Cargando auditoría…" /> : <div className="admin-table-wrap">
          <table className="admin-table"><thead><tr><th>Fecha</th><th>Admin</th><th>Acción</th><th>Recurso</th><th>ID</th><th>Payload</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("es-CO")}</td><td>{item.admin_user_id ?? "Sistema"}</td><td>{item.action}</td><td>{item.resource_type ?? "—"}</td><td>{item.resource_id ?? "—"}</td><td><pre className="admin-json-inline">{item.payload_json ?? "{}"}</pre></td></tr>)}</tbody>
          </table>
          {!items.length && <div className="admin-empty"><h3>No hay eventos con estos filtros</h3></div>}
          <div className="modal-actions"><span className="muted">{total} eventos</span><button className="admin-button" type="button" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - 50))}>Anterior</button><button className="admin-button" type="button" disabled={offset + items.length >= total || items.length < 50} onClick={() => void load(offset + 50)}>Siguiente</button></div>
        </div>}
      </section>
    </section></main>
  );
}
