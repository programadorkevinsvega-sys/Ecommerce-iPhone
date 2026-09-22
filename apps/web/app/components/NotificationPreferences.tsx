"use client";

import { useCallback, useEffect, useState } from "react";

type NotificationScope = "customer" | "technician" | "admin";
type Preference = { channel: "EMAIL" | "IN_APP"; eventType: string; enabled: boolean };

export default function NotificationPreferences({ scope }: { scope: NotificationScope }) {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/preferences?scope=" + scope, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json() as { items?: Preference[] };
      setPreferences(data.items ?? []);
    } catch {
      setError("No se pudieron cargar las preferencias.");
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  function enabled(channel: Preference["channel"]) {
    return preferences.find((item) => item.channel === channel && item.eventType === "*")?.enabled ?? true;
  }

  async function update(channel: Preference["channel"], value: boolean) {
    setSaving(channel);
    setError("");
    try {
      const response = await fetch("/api/notifications/preferences?scope=" + scope, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, eventType: "*", enabled: value }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar la preferencia.");
      setPreferences((current) => [
        ...current.filter((item) => !(item.channel === channel && item.eventType === "*")),
        { channel, eventType: "*", enabled: value },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la preferencia.");
    } finally {
      setSaving("");
    }
  }

  return (
    <section className="notification-preferences">
      <div>
        <p className="eyebrow">Preferencias</p>
        <h2>Cómo quieres recibir actualizaciones</h2>
      </div>
      {error ? <p className="notification-inbox-error" role="alert">{error}</p> : null}
      <label className="notification-preference-row">
        <span>
          <strong>Notificaciones dentro de la cuenta</strong>
          <small>Actualizaciones visibles en tiempo real y en tu historial.</small>
        </span>
        <input type="checkbox" checked={enabled("IN_APP")} disabled={saving === "IN_APP"} onChange={(event) => void update("IN_APP", event.target.checked)} />
      </label>
      <label className="notification-preference-row">
        <span>
          <strong>Correo electrónico</strong>
          <small>Correos transaccionales asociados a pedidos y servicios.</small>
        </span>
        <input type="checkbox" checked={enabled("EMAIL")} disabled={saving === "EMAIL"} onChange={(event) => void update("EMAIL", event.target.checked)} />
      </label>
    </section>
  );
}
