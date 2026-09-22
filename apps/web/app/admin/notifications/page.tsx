"use client";

import { useCallback, useEffect, useState } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Delivery = {
  id: string;
  outbox_id: string;
  channel: string;
  recipient: string;
  template: string;
  provider: string;
  provider_message_id?: string;
  status: string;
  attempts: number;
  error_message?: string;
  created_at: string;
  event_type: string;
  aggregate_id: string;
};

type DeadLetter = {
  id: string;
  queueName: string;
  messageId?: string;
  messageBody: string;
  status: "OPEN" | "REPLAYED";
  attempts: number;
  firstSeenAt: string;
  lastReplayedAt?: string;
  replayedBy?: string;
};

type Snapshot = {
  deliveries: Delivery[];
  queue: { status: string; count: number }[];
};

export default function NotificationsPage() {
  const [data, setData] = useState<Snapshot>({ deliveries: [], queue: [] });
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlqLoading, setDlqLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dlqError, setDlqError] = useState("");

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

  const loadDeadLetters = useCallback(async () => {
    setDlqLoading(true);
    setDlqError("");
    try {
      const response = await fetch("/api/admin/notifications/dead-letter?limit=100", { cache: "no-store", credentials: "same-origin" });
      const body = await response.json() as { items?: DeadLetter[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el DLQ.");
      setDeadLetters(body.items ?? []);
    } catch (caught) {
      setDlqError(caught instanceof Error ? caught.message : "No se pudo cargar el DLQ.");
    } finally {
      setDlqLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadDeadLetters();
  }, [load, loadDeadLetters]);

  async function replay(id: string) {
    if (busy) return;
    if (!window.confirm("¿Reprocesar este evento del DLQ mediante el pipeline real de notificaciones?")) return;
    setBusy(id);
    setDlqError("");
    try {
      const response = await fetch("/api/admin/notifications/replay", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo reprocesar el evento.");
      await loadDeadLetters();
      await load();
    } catch (caught) {
      setDlqError(caught instanceof Error ? caught.message : "No se pudo reprocesar el evento.");
    } finally {
      setBusy("");
    }
  }

  return (
    <AdminPageShell
      active="notifications"
      kicker="Operaciones"
      title="Notificaciones"
      description="Estado real del outbox, entregas y fallos terminales del pipeline de notificaciones."
      actions={<button className="admin-button" type="button" onClick={() => { void load(); void loadDeadLetters(); }}>Actualizar</button>}
    >
      {error && <p className="admin-error" role="alert">{error}</p>}
      {dlqError && <p className="admin-error" role="alert">{dlqError}</p>}

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

          <AdminPanel className="admin-page-table-panel">
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

          <AdminPanel className="admin-page-table-panel">
            <AdminSectionHeading
              kicker="Resiliencia"
              title="Dead-letter queue"
              meta={<span className="muted">{deadLetters.filter((item) => item.status === "OPEN").length} pendientes</span>}
            />
            {dlqLoading ? (
              <AdminLoadingState label="Cargando mensajes terminales…" />
            ) : (
              <AdminTable
                headers={["Fecha", "Queue", "Intentos", "Estado", "Mensaje", "Acción"]}
                empty={!deadLetters.length ? <AdminEmptyState title="El DLQ está vacío" description="No hay mensajes agotados esperando intervención." /> : undefined}
              >
                {deadLetters.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.firstSeenAt).toLocaleString("es-CO")}</td>
                    <td>{item.queueName}</td>
                    <td>{item.attempts}</td>
                    <td>{item.status}</td>
                    <td><pre className="admin-json-inline">{item.messageBody}</pre></td>
                    <td>
                      {item.status === "OPEN" ? (
                        <button className="table-action" type="button" disabled={Boolean(busy)} onClick={() => void replay(item.id)}>
                          {busy === item.id ? "Reprocesando…" : "Reprocesar"}
                        </button>
                      ) : (
                        <span className="muted">Reprocesado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminPanel>
        </>
      )}
    </AdminPageShell>
  );
}
