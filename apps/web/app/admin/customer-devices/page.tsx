"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminSidebar from "../AdminSidebar";
import AdminLoadingState from "../AdminLoadingState";

type Device = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  deviceType: string;
  brand: string;
  model: string;
  serialLast4: string | null;
  imeiLast4: string | null;
  color: string | null;
  capacity: string | null;
  physicalCondition: string | null;
  notes: string | null;
  archivedAt: string | null;
};

type FormState = {
  customerId: string;
  deviceType: string;
  brand: string;
  model: string;
  serialLast4: string;
  imeiLast4: string;
  color: string;
  capacity: string;
  physicalCondition: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  customerId: "",
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

const DEVICE_TYPES: Record<string, string> = {
  PHONE: "Teléfono",
  TABLET: "Tablet",
  LAPTOP: "Portátil",
  WATCH: "Reloj",
  OTHER: "Otro",
};

export default function AdminCustomerDevicesPage() {
  const [items, setItems] = useState<Device[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [devicesResponse, customersResponse] = await Promise.all([
        fetch(`/api/admin/customer-devices?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/admin/customers", { cache: "no-store", credentials: "same-origin" }),
      ]);

      if (devicesResponse.status === 401 || devicesResponse.status === 403) {
        window.location.href = "/admin/login";
        return;
      }

      const devices = (await devicesResponse.json()) as { items?: Device[]; error?: string };
      if (!devicesResponse.ok) {
        setError(devices.error ?? "No se pudieron cargar los dispositivos.");
        return;
      }

      setItems(devices.items ?? []);

      if (customersResponse.ok) {
        const data = (await customersResponse.json()) as {
          items?: Array<Record<string, unknown>>;
        };
        setCustomers(
          (data.items ?? []).map((item) => ({
            id: String(item.id),
            name: [item.firstName, item.lastName].filter(Boolean).join(" "),
            email: String(item.email ?? ""),
          })),
        );
      }
    } catch {
      setError("No se pudieron cargar los datos del inventario de dispositivos.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  function edit(device: Device) {
    setEditing(device.id);
    setForm({
      customerId: device.customerId,
      deviceType: device.deviceType,
      brand: device.brand,
      model: device.model,
      serialLast4: device.serialLast4 ?? "",
      imeiLast4: device.imeiLast4 ?? "",
      color: device.color ?? "",
      capacity: device.capacity ?? "",
      physicalCondition: device.physicalCondition ?? "",
      notes: device.notes ?? "",
    });
    setNotice("");
    setError("");
  }

  function reset() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        editing
          ? `/api/admin/customer-devices/${encodeURIComponent(editing)}`
          : "/api/admin/customer-devices",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(form),
        },
      );

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar el dispositivo.");
        return;
      }

      setNotice(editing ? "Dispositivo actualizado correctamente." : "Dispositivo registrado correctamente.");
      reset();
      await load();
    } catch {
      setError("No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(id: string, archived: boolean) {

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/customer-devices/${encodeURIComponent(id)}`, {
        method: archived ? "DELETE" : "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? (archived ? "No se pudo archivar el dispositivo." : "No se pudo restaurar el dispositivo."));
        return;
      }
      setNotice(archived ? "Dispositivo archivado." : "Dispositivo restaurado.");
      await load();
    } catch {
      setError(archived ? "No se pudo archivar el dispositivo." : "No se pudo restaurar el dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <AdminSidebar active="customer-devices" />
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Operación</p>
            <h1>Dispositivos de clientes</h1>
            <p>Registro centralizado de equipos asociados a clientes y preparados para reparaciones.</p>
          </div>
        </header>

        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}

        <section className="admin-workspace admin-page-grid">
          <div className="admin-page-panel">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">Ficha del equipo</p>
                <h2>{editing ? "Editar dispositivo" : "Registrar dispositivo"}</h2>
              </div>
              {editing && <button className="admin-button" type="button" onClick={reset}>Nuevo</button>}
            </div>

            <form className="admin-form" onSubmit={save}>
              <div className="form-grid">
                <label>
                  Cliente
                  <select required value={form.customerId} onChange={(e) => setField("customerId", e.target.value)}>
                    <option value="">Selecciona un cliente</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name || customer.email} — {customer.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo
                  <select value={form.deviceType} onChange={(e) => setField("deviceType", e.target.value)}>
                    {Object.entries(DEVICE_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Marca
                  <input required maxLength={60} value={form.brand} onChange={(e) => setField("brand", e.target.value)} />
                </label>
                <label>
                  Modelo
                  <input required maxLength={100} value={form.model} onChange={(e) => setField("model", e.target.value)} />
                </label>
                <label>
                  Últimos 4 IMEI
                  <input maxLength={4} inputMode="numeric" value={form.imeiLast4} onChange={(e) => setField("imeiLast4", e.target.value)} />
                </label>
                <label>
                  Últimos 4 serial
                  <input maxLength={4} value={form.serialLast4} onChange={(e) => setField("serialLast4", e.target.value)} />
                </label>
                <label>
                  Color
                  <input maxLength={60} value={form.color} onChange={(e) => setField("color", e.target.value)} />
                </label>
                <label>
                  Capacidad
                  <input maxLength={40} value={form.capacity} onChange={(e) => setField("capacity", e.target.value)} />
                </label>
              </div>

              <label>
                Estado físico
                <textarea rows={3} maxLength={1000} value={form.physicalCondition} onChange={(e) => setField("physicalCondition", e.target.value)} />
              </label>
              <label>
                Notas internas
                <textarea rows={3} maxLength={1000} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
              </label>

              <div className="modal-actions">
                {editing && <button className="admin-button" type="button" onClick={reset}>Cancelar</button>}
                <button className="admin-button primary" disabled={busy} type="submit">
                  {busy ? "Guardando…" : editing ? "Guardar cambios" : "Registrar dispositivo"}
                </button>
              </div>
            </form>
          </div>

          <div className="admin-page-panel admin-page-table-panel">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">Registro</p>
                <h2>Dispositivos registrados</h2>
              </div>
              <span className="muted">{items.length} equipos</span>
            </div>

            <div className="admin-toolbar">
              <label className="admin-search admin-search-wide">
                <span>⌕</span>
                <input
                  type="search"
                  aria-label="Buscar dispositivos"
                  placeholder="Buscar cliente, correo, marca o modelo…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>

            <div className="admin-table-wrap">
              {loading ? (
                <AdminLoadingState label="Cargando dispositivos…" />
              ) : (
                <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Equipo</th>
                    <th>Identificación</th>
                    <th>Estado</th>
                    <th className="align-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <strong>{device.customerName || "Sin nombre"}</strong>
                        <span className="table-subtext">{device.customerEmail}</span>
                      </td>
                      <td>
                        <strong>{device.brand} {device.model}</strong>
                        <span className="table-subtext">
                          {DEVICE_TYPES[device.deviceType] ?? device.deviceType} · {device.color ?? "Sin color"} · {device.capacity ?? "Sin capacidad"}
                        </span>
                      </td>
                      <td>
                        <span className="table-subtext">IMEI ••••{device.imeiLast4 ?? "----"}</span>
                        <span className="table-subtext">Serial ••••{device.serialLast4 ?? "----"}</span>
                      </td>
                      <td>
                        <span className={`status ${device.archivedAt ? "muted-status" : "success"}`}>
                          {device.archivedAt ? "Archivado" : "Activo"}
                        </span>
                      </td>
                      <td className="align-right">
                        <button className="table-action" type="button" onClick={() => edit(device)} disabled={Boolean(device.archivedAt)}>
                          Editar
                        </button>
                        <button className="table-action danger" type="button" onClick={() => {
                            if (!window.confirm(device.archivedAt ? "¿Restaurar este dispositivo?" : "¿Archivar este dispositivo?")) return;
                            void setArchived(device.id, !device.archivedAt);
                          }} disabled={busy}>
                          {device.archivedAt ? "Restaurar" : "Archivar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length && (
                <div className="admin-empty">
                  <span>▱</span>
                  <h3>No hay dispositivos registrados</h3>
                  <p>Los equipos que reciba el taller aparecerán aquí.</p>
                </div>
              )}
                </>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
