"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "../AdminSidebar";
import AdminLoadingState from "../AdminLoadingState";

type Review = {
  id: string; productId: string; productName: string; customerId: string; orderId: string; rating: number;
  title: string; body: string; status: "PENDING" | "APPROVED" | "REJECTED"; verifiedPurchase: number | boolean;
  adminResponse?: string; createdAt: string;
};

export default function ReviewsPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [responseText, setResponseText] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (status) params.set("status", status);
    if (productId.trim()) params.set("productId", productId.trim());
    try {
      const response = await fetch(`/api/admin/reviews?${params}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json() as { items?: Review[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las reseñas.");
      setItems(data.items ?? []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron cargar las reseñas."); }
    finally { setLoading(false); }
  }, [status, productId]);

  useEffect(() => { void load(); }, [load]);

  async function moderate(id: string, nextStatus: "APPROVED" | "REJECTED") {
    setBusy(id + nextStatus); setError("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus, adminResponse: responseText[id] ?? "" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo moderar la reseña.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo moderar la reseña."); }
    finally { setBusy(""); }
  }

  return (
    <main className="admin-shell"><AdminSidebar active="reviews" /><section className="admin-content">
      <header className="admin-topbar"><div><p className="admin-kicker">Contenido</p><h1>Reseñas</h1><p>Modera reseñas reales de clientes y registra la respuesta administrativa.</p></div></header>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <section className="admin-workspace admin-page-panel">
        <div className="admin-toolbar"><label>Estado<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></select></label><label>Producto<input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="ID del producto" /></label><button className="admin-button" type="button" onClick={() => void load()}>Actualizar</button></div>
        {loading ? <AdminLoadingState label="Cargando reseñas…" /> : <div className="admin-table-wrap">
          <table className="admin-table"><thead><tr><th>Producto</th><th>Cliente</th><th>Rating</th><th>Contenido</th><th>Estado</th><th>Moderación</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong><span className="table-subtext">{item.productId}</span></td><td>{item.customerId}</td><td>{item.rating}/5</td><td><strong>{item.title}</strong><p>{item.body}</p></td><td>{item.status}</td><td>{item.status === "PENDING" ? <div><textarea rows={3} value={responseText[item.id] ?? ""} onChange={(e) => setResponseText((v) => ({...v, [item.id]: e.target.value}))} placeholder="Respuesta administrativa opcional" /><button className="table-action" disabled={Boolean(busy)} onClick={() => void moderate(item.id, "APPROVED")}>Aprobar</button><button className="table-action danger" disabled={Boolean(busy)} onClick={() => void moderate(item.id, "REJECTED")}>Rechazar</button></div> : <span className="muted">{item.adminResponse ?? "Sin respuesta"}</span>}</td></tr>)}</tbody>
          </table>
          {!items.length && <div className="admin-empty"><h3>No hay reseñas para este filtro</h3></div>}
        </div>}
      </section>
    </section></main>
  );
}
