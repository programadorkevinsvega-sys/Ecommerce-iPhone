"use client";

import { useCallback, useEffect, useState } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Delivery = { id: string; outbox_id: string; channel: string; recipient: string; template: string; provider: string; provider_message_id?: string; status: string; attempts: number; error_message?: string; created_at: string; event_type: string; aggregate_id: string };
type Snapshot = { deliveries: Delivery[]; queue: { status: string; count: number }[] };

export default function NotificationsPage() {
  const [data, setData] = useState<Snapshot>({ deliveries: [], queue: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/notifications?limit=100", { cache: "no-store", credentials: "same-origin" });
      const body = (await response.json()) as Snapshot & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las notificaciones.");
      setData({ deliveries: body.deliveries ?? [], queue: body.queue ?? [] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminPageShell
      active="notifications"
      kicker="Operaciones"
      title="Notificaciones"
      description="Estado real del outbox de notificaciones y de las entregas procesadas por el proveedor."
      actions={<button className="admin-button" type="button" onClick={() => void load()}>Actualizar</button>}
    >
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? (
        <AdminLoadingState label="Cargando notificaciones…" />
      ) : (
        <>
          <section className="admin-workspace admin-summary-grid">
            {data.queue.map((item) => (
              <article className="admin-summary-card" key={item.status}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </article>
            ))}
          </section>
          <AdminPanel>
            <AdminSectionHeading kicker="Entregas" title="Historial de entregas" meta={<span className="muted">{data.deliveries.length} mostradas</span>} />
            <AdminTable
              headers={["Fecha", "Evento", "Canal", "Destinatario", "Proveedor", "Estado", "Intentos", "Error"]}
              empty={!data.deliveries.length ? <AdminEmptyState title="No hay entregas registradas" /> : undefined}
            >
              {data.deliveries.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString("es-CO")}</td>
                  <td>{item.event_type}<span className="table-subtext">{item.aggregate_id}</span></td>
                  <td>{item.channel}</td>
                  <td>{item.recipient}</td>
                  <td>{item.provider}</td>
                  <td>{item.status}</td>
                  <td>{item.attempts}</td>
                  <td>{item.error_message ?? "—"}</td>
                </tr>
              ))}
            </AdminTable>
          </AdminPanel>
        </>
      )}
    </AdminPageShell>
  );
}
