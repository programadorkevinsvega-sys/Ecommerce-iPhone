"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NotificationScope = "customer" | "technician" | "admin";

type Item = {
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
};

type NotificationInboxProps = {
  scope: NotificationScope;
  title: string;
  subtitle: string;
};

export default function NotificationInbox({ scope, title, subtitle }: NotificationInboxProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (append = false, nextCursor?: string | null) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ scope, limit: "50" });
      const effectiveCursor = append ? (nextCursor ?? cursor) : null;
      if (effectiveCursor) params.set("cursor", effectiveCursor);
      const response = await fetch("/api/notifications?" + params.toString(), {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json() as { items?: Item[]; nextCursor?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las notificaciones.");
      setItems((current) => {
        const incoming = data.items ?? [];
        if (!append) return incoming;
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...incoming.filter((item) => !existing.has(item.id))];
      });
      setCursor(data.nextCursor ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }, [cursor, scope]);

  const loadUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count?scope=" + scope, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json() as { unread?: number };
      setUnread(Number(data.unread ?? 0));
    } catch {}
  }, [scope]);

  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    void load(false);
    void loadUnread();
  }, [load, loadUnread]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/realtime?scope=${scope}`);
      socket.addEventListener("open", () => { attempt = 0; });
      socket.addEventListener("message", () => {
        void loadRef.current(false);
        void loadUnread();
      });
      socket.addEventListener("close", () => {
        if (disposed) return;
        const delay = Math.min(30000, 1000 * 2 ** attempt);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay + Math.floor(Math.random() * Math.max(1, delay)));
      });
      socket.addEventListener("error", () => socket?.close());
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [loadUnread, scope]);

  async function read(id: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read?scope=${scope}`, {
        method: "PATCH",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("No se pudo marcar la notificación.");
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnread((value) => Math.max(0, value - 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar la notificación.");
    } finally {
      setBusy("");
    }
  }

  async function readAll() {
    setBusy("all");
    try {
      const response = await fetch("/api/notifications/read-all?scope=" + scope, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("No se pudieron marcar las notificaciones.");
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron marcar las notificaciones.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="notification-inbox">
      <header className="notification-inbox-head">
        <div>
          <p className="eyebrow">Centro de notificaciones</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button type="button" className="button secondary" disabled={!unread || busy === "all"} onClick={() => void readAll()}>
          Marcar todo leído{unread ? ` (${unread})` : ""}
        </button>
      </header>

      {error ? <div className="notification-inbox-error" role="alert">{error}</div> : null}

      {loading && !items.length ? (
        <div className="notification-inbox-state" role="status">Cargando notificaciones…</div>
      ) : !items.length ? (
        <div className="notification-inbox-state"><strong>No tienes notificaciones.</strong><span>Las actualizaciones importantes aparecerán aquí.</span></div>
      ) : (
        <div className="notification-inbox-list">
          {items.map((item) => (
            <article className={`notification-inbox-item ${item.readAt ? "read" : "unread"}`} key={item.id}>
              <div className="notification-inbox-dot" aria-hidden="true" />
              <div className="notification-inbox-copy">
                <div className="notification-inbox-meta">
                  <span>{item.eventType}</span>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("es-CO")}</time>
                </div>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
                {!item.readAt ? <button type="button" className="text-link" disabled={busy === item.id} onClick={() => void read(item.id)}>Marcar como leída →</button> : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {cursor ? <button type="button" className="button secondary notification-inbox-more" onClick={() => void load(true)} disabled={loading}>Cargar anteriores</button> : null}
    </section>
  );
}
