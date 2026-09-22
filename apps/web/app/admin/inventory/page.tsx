"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminToolbar from "../AdminToolbar";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Adjustment = { id: string; productId: string; adminUserId: string; delta: number; reason: string; idempotencyKey: string; createdAt: string };
const empty = { productId: "", delta: "", reason: "" };

export default function InventoryPage() {
  const [items, setItems] = useState<Adjustment[]>([]);
  const [form, setForm] = useState(empty);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (productId.trim()) params.set("productId", productId.trim());
      const response = await fetch("/api/admin/inventory?" + params, { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as { items?: Adjustment[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el inventario.");
      setItems(data.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const key = crypto.randomUUID();
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        credentials: "same-origin",
        body: JSON.stringify({ productId: form.productId, delta: Number(form.delta), reason: form.reason, idempotencyKey: key }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo ajustar el stock.");
      setMessage("Ajuste de inventario aplicado.");
      setForm(empty);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo ajustar el inventario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell active="inventory" kicker="Inventario" title="Inventario" description="Consulta ajustes registrados y aplica movimientos de stock de forma idempotente.">
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-notice" role="status">{message}</p>}
      <section className="admin-workspace admin-page-grid">
        <AdminPanel>
          <AdminSectionHeading kicker="Movimiento" title="Ajustar stock" />
          <form className="admin-form" onSubmit={save}>
            <label>Producto ID<input required value={form.productId} onChange={(event) => setForm((value) => ({ ...value, productId: event.target.value }))} /></label>
            <label>Diferencia<input required type="number" step="1" value={form.delta} onChange={(event) => setForm((value) => ({ ...value, delta: event.target.value }))} /></label>
            <label>Motivo<textarea required maxLength={500} rows={5} value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} /></label>
            <button className="admin-button primary" disabled={saving}>{saving ? "Aplicando…" : "Aplicar ajuste"}</button>
          </form>
        </AdminPanel>

        <AdminPanel className="admin-page-table-panel">
          <AdminToolbar>
            <label>Filtrar producto<input value={productId} onChange={(event) => setProductId(event.target.value)} /></label>
            <button className="admin-button" type="button" onClick={() => void load()}>Actualizar</button>
          </AdminToolbar>
          {loading ? (
            <AdminLoadingState label="Cargando movimientos…" />
          ) : (
            <AdminTable
              headers={["Fecha", "Producto", "Delta", "Admin", "Motivo", "Idempotencia"]}
              empty={!items.length ? <AdminEmptyState title="No hay movimientos" /> : undefined}
            >
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString("es-CO")}</td>
                  <td>{item.productId}</td>
                  <td className={item.delta < 0 ? "stock-low" : ""}>{item.delta > 0 ? "+" : ""}{item.delta}</td>
                  <td>{item.adminUserId}</td>
                  <td>{item.reason}</td>
                  <td>{item.idempotencyKey}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </AdminPanel>
      </section>
    </AdminPageShell>
  );
}
