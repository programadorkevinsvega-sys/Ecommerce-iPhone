"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Device = {
  id: string;
  customerId: string;
  deviceType: string;
  brand: string;
  model: string;
  serialLast4: string | null;
  imeiLast4: string | null;
  color: string | null;
  capacity: string | null;
  physicalCondition: string | null;
  notes: string | null;
};

const empty = { deviceType: "PHONE", brand: "", model: "", imeiLast4: "", serialLast4: "", color: "", capacity: "", physicalCondition: "", notes: "" };

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/customer/devices", { cache: "no-store" });
    if (response.ok) setDevices((await response.json()).devices);
  }

  useEffect(() => { void load(); }, []);

  function change(key: keyof typeof empty, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function edit(device: Device) {
    setEditingId(device.id);
    setForm({
      deviceType: device.deviceType,
      brand: device.brand,
      model: device.model,
      imeiLast4: device.imeiLast4 ?? "",
      serialLast4: device.serialLast4 ?? "",
      color: device.color ?? "",
      capacity: device.capacity ?? "",
      physicalCondition: device.physicalCondition ?? "",
      notes: device.notes ?? "",
    });
    setMessage("");
  }

  function reset() {
    setEditingId(null);
    setForm(empty);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(editingId ? `/api/customer/devices/${editingId}` : "/api/customer/devices", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (response.ok) {
      setMessage(editingId ? "Dispositivo actualizado." : "Dispositivo guardado.");
      reset();
      await load();
    } else {
      setMessage("Revisa los datos ingresados.");
    }
  }

  async function archive(id: string) {
    const response = await fetch(`/api/customer/devices/${id}`, { method: "DELETE" });
    setMessage(response.ok ? "Dispositivo retirado de tu cuenta." : "No fue posible retirar el dispositivo.");
    if (response.ok) await load();
  }

  return <main className="store-shell auth-page"><section className="auth-card">
    <p className="eyebrow">Mi cuenta</p><h1>Mis dispositivos.</h1>
    <form onSubmit={save}>
      <label>Tipo<select value={form.deviceType} onChange={e => change("deviceType", e.target.value)}><option value="PHONE">Teléfono</option><option value="TABLET">Tablet</option><option value="LAPTOP">Portátil</option><option value="WATCH">Reloj</option><option value="OTHER">Otro</option></select></label>
      <div className="form-two"><label>Marca<input value={form.brand} onChange={e => change("brand", e.target.value)} required /></label><label>Modelo<input value={form.model} onChange={e => change("model", e.target.value)} required /></label></div>
      <div className="form-two"><label>Últimos 4 del IMEI<input value={form.imeiLast4} onChange={e => change("imeiLast4", e.target.value)} maxLength={4} /></label><label>Últimos 4 del serial<input value={form.serialLast4} onChange={e => change("serialLast4", e.target.value)} maxLength={4} /></label></div>
      <div className="form-two"><label>Color<input value={form.color} onChange={e => change("color", e.target.value)} /></label><label>Capacidad<input value={form.capacity} onChange={e => change("capacity", e.target.value)} /></label></div>
      <label>Estado físico conocido<textarea value={form.physicalCondition} onChange={e => change("physicalCondition", e.target.value)} maxLength={1000} /></label>
      <label>Notas<textarea value={form.notes} onChange={e => change("notes", e.target.value)} maxLength={1000} /></label>
      <div className="form-two"><button className="button primary">{editingId ? "Actualizar" : "Guardar dispositivo"}</button>{editingId && <button type="button" className="button" onClick={reset}>Cancelar</button>}</div>
    </form>
    {message && <p role="status">{message}</p>}
    <div className="account-list">{devices.map(device => <article className="account-row" key={device.id}><div><strong>{device.brand} {device.model}</strong><p>{device.deviceType} · {device.color ?? "Sin color"} · {device.capacity ?? "Sin capacidad"}</p></div><div><button className="link-button" onClick={() => edit(device)}>Editar</button><button className="link-button" onClick={() => void archive(device.id)}>Retirar</button></div></article>)}</div>
    <p><Link href="/cuenta">Volver a mi cuenta</Link></p>
  </section></main>;
}
