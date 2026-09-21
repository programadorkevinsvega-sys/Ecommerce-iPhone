"use client";

import { useCallback, useEffect, useState } from "react";
import TechnicianHeader from "../TechnicianHeader";

type Device = {
  id: string;
  deviceType: string;
  brand: string;
  model: string;
  serialLast4?: string | null;
  imeiLast4?: string | null;
  color?: string | null;
  capacity?: string | null;
  physicalCondition?: string | null;
  notes?: string | null;
};
type Row = {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  device: Device;
};

const EMPTY = {
  deviceType: "PHONE",
  brand: "",
  model: "",
  serialLast4: "",
  imeiLast4: "",
  color: "",
  capacity: "",
  physicalCondition: "",
  notes: "",
};

export default function TechnicianDevices() {
  const [rows, setRows] = useState<Row[]>([]);
  const [orders, setOrders] = useState<{ id: string; orderNumber: string; customerDeviceId?: string; device: { brand: string; model: string } }[]>([]);
  const [orderId, setOrderId] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [response, orderResponse] = await Promise.all([
        fetch("/api/technician/devices", { cache: "no-store" }),
        fetch("/api/technician/orders", { cache: "no-store" }),
      ]);

      if (response.status === 401 || orderResponse.status === 401) {
        window.location.href = "/technician/login";
        return;
      }

      const data = await response.json() as { items?: Row[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudieron cargar los dispositivos.");
        return;
      }

      const orderData = await orderResponse.json() as {
        items?: { id: string; orderNumber: string; customerDeviceId?: string; device: { brand: string; model: string } }[];
        error?: string;
      };
      if (!orderResponse.ok) {
        setError(orderData.error ?? "No se pudieron cargar las órdenes disponibles.");
        return;
      }

      setRows(data.items ?? []);
      setOrders((orderData.items ?? []).filter((item) => !item.customerDeviceId));
    } catch {
      setError("No se pudo contactar al servicio de dispositivos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectRow(row: Row) {
    setEditing(row.orderId);
    setOrderId(row.orderId);
    setForm({
      deviceType: row.device.deviceType,
      brand: row.device.brand,
      model: row.device.model,
      serialLast4: row.device.serialLast4 ?? "",
      imeiLast4: row.device.imeiLast4 ?? "",
      color: row.device.color ?? "",
      capacity: row.device.capacity ?? "",
      physicalCondition: row.device.physicalCondition ?? "",
      notes: row.device.notes ?? "",
    });
    setMessage("");
    setError("");
  }

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((state) => ({ ...state, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!orderId || saving) {
      setMessage("Selecciona una orden.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const endpoint = editing
        ? `/api/technician/devices/${encodeURIComponent(orderId)}`
        : "/api/technician/devices";

      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, orderId }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar el dispositivo.");
        return;
      }

      setMessage(editing ? "Dispositivo actualizado." : "Dispositivo registrado y enlazado a la orden.");
      setForm(EMPTY);
      setOrderId("");
      setEditing(null);
      await load();
    } catch {
      setError("No se pudo guardar el dispositivo. Inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="technician-shell">
      <TechnicianHeader />

      <section className="technician-page-head">
        <div>
          <p className="eyebrow">Recepción</p>
          <h1>Dispositivos.</h1>
          <p>Registra el equipo recibido y deja sus datos enlazados a la orden correspondiente.</p>
        </div>
        <span className="technician-count">{loading ? "Cargando…" : `${rows.length} registrados`}</span>
      </section>

      {error && (
        <div className="technician-alert" role="alert">
          <strong>No se pudo completar la operación.</strong>
          <span>{error}</span>
          <button type="button" className="button secondary" onClick={() => void load()} disabled={loading}>
            Reintentar
          </button>
        </div>
      )}

      <section className="technician-dashboard-grid">
        <article className="technician-card">
          <div className="technician-section-head">
            <div>
              <p className="eyebrow">Ficha del equipo</p>
              <h2>{editing ? "Editar dispositivo" : "Registrar equipo recibido"}</h2>
            </div>
          </div>

          <form onSubmit={(event) => void save(event)} className="technician-form">
            <label>
              Orden
              <select required value={orderId} disabled={Boolean(editing) || saving || loading} onChange={(event) => setOrderId(event.target.value)}>
                <option value="">Seleccionar orden</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} · {order.device.brand} {order.device.model}
                  </option>
                ))}
              </select>
            </label>

            <div className="technician-form-grid">
              <label>
                Tipo
                <select value={form.deviceType} disabled={saving} onChange={(event) => set("deviceType", event.target.value)}>
                  <option value="PHONE">TELÉFONO</option>
                  <option value="TABLET">TABLET</option>
                  <option value="LAPTOP">PORTÁTIL</option>
                  <option value="WATCH">RELOJ</option>
                  <option value="OTHER">OTRO</option>
                </select>
              </label>
              <label>Marca<input required value={form.brand} disabled={saving} onChange={(event) => set("brand", event.target.value)} /></label>
              <label>Modelo<input required value={form.model} disabled={saving} onChange={(event) => set("model", event.target.value)} /></label>
              <label>
                Últimos 4 IMEI
                <input inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={form.imeiLast4} disabled={saving} onChange={(event) => set("imeiLast4", event.target.value.replace(/\D/g, "").slice(0, 4))} />
              </label>
              <label>
                Últimos 4 serial
                <input maxLength={4} value={form.serialLast4} disabled={saving} onChange={(event) => set("serialLast4", event.target.value.slice(0, 4))} />
              </label>
              <label>Color<input value={form.color} disabled={saving} onChange={(event) => set("color", event.target.value)} /></label>
              <label>Capacidad<input value={form.capacity} disabled={saving} onChange={(event) => set("capacity", event.target.value)} /></label>
            </div>

            <label>Estado físico<textarea rows={4} value={form.physicalCondition} disabled={saving} onChange={(event) => set("physicalCondition", event.target.value)} /></label>
            <label>Notas<textarea rows={4} value={form.notes} disabled={saving} onChange={(event) => set("notes", event.target.value)} /></label>

            {message && <p className="technician-form-note" role="status" aria-live="polite">{message}</p>}
            {error && <p className="technician-form-error" role="alert">{error}</p>}

            <div className="technician-actions">
              <button className="button primary" disabled={saving || loading || !orderId}>
                {saving ? "Guardando…" : editing ? "Actualizar dispositivo" : "Registrar dispositivo"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setEditing(null);
                    setOrderId("");
                    setForm(EMPTY);
                    setMessage("");
                    setError("");
                  }}
                  disabled={saving}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="technician-card">
          <div className="technician-section-head">
            <div>
              <p className="eyebrow">Inventario recibido</p>
              <h2>Dispositivos registrados</h2>
            </div>
          </div>

          {loading ? (
            <div className="technician-empty" role="status" aria-live="polite">
              <strong>Cargando dispositivos.</strong>
              <span>Consultando equipos asociados a tus órdenes.</span>
            </div>
          ) : (
            <div className="technician-device-list">
              {rows.map((row) => (
                <button
                  type="button"
                  className="technician-device-row"
                  key={row.device.id}
                  onClick={() => selectRow(row)}
                  aria-pressed={editing === row.orderId}
                >
                  <span className="technician-device-icon" aria-hidden="true">⌁</span>
                  <span>
                    <strong>{row.device.brand} {row.device.model}</strong>
                    <small>{row.orderNumber} · {row.customerEmail}</small>
                    <small>IMEI ••••{row.device.imeiLast4 ?? "----"} · Serial ••••{row.device.serialLast4 ?? "----"}</small>
                  </span>
                </button>
              ))}
              {!rows.length && (
                <div className="technician-empty">
                  <strong>No hay dispositivos registrados.</strong>
                  <span>Se añadirán al vincular un equipo recibido con una orden.</span>
                </div>
              )}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
