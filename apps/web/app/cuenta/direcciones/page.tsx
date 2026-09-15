"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Address = Readonly<{ id: string; label: string; recipientName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; state: string; postalCode?: string; countryCode: string; isDefault: boolean }>;

const empty = { label: "Principal", recipientName: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", countryCode: "CO", isDefault: true };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/customer/addresses", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/cuenta/login";
      return;
    }
    if (!response.ok) throw new Error("No pudimos cargar tus direcciones.");
    setAddresses((await response.json()).addresses);
  }

  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : "No pudimos cargar tus direcciones.")); }, []);

  function startEdit(address: Address) {
    setEditing(address);
    setForm({ ...address, addressLine2: address.addressLine2 ?? "", postalCode: address.postalCode ?? "" });
    setMessage("");
    setError("");
  }

  function reset() {
    setEditing(null);
    setForm(empty);
    setMessage("");
    setError("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const response = await fetch(editing ? `/api/customer/addresses/${editing.id}` : "/api/customer/addresses", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "No pudimos guardar la dirección.");
      return;
    }
    setMessage(editing ? "Dirección actualizada." : "Dirección guardada.");
    reset();
    await load();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/customer/addresses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("No pudimos eliminar la dirección.");
      return;
    }
    setMessage("Dirección eliminada.");
    await load();
  }

  return (
    <main className="store-shell auth-page">
      <section className="auth-card">
        <p className="eyebrow">Mi cuenta</p>
        <h1>Direcciones de recepción.</h1>
        <form onSubmit={save}>
          <div className="form-two"><label>Etiqueta<input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required /></label><label>País<input value={form.countryCode} onChange={e => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} maxLength={2} required /></label></div>
          <label>Nombre del destinatario<input value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} required /></label>
          <label>Teléfono<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required autoComplete="tel" /></label>
          <label>Dirección<input value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} required /></label>
          <label>Complemento<input value={form.addressLine2} onChange={e => setForm({ ...form, addressLine2: e.target.value })} /></label>
          <div className="form-two"><label>Ciudad<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} required /></label><label>Departamento/Estado<input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} required /></label></div>
          <label>Código postal<input value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} /></label>
          <label><input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /> Usar como dirección principal</label>
          {message && <p role="status">{message}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="button-row"><button className="button primary">{editing ? "Actualizar dirección" : "Guardar dirección"}</button>{editing && <button type="button" className="button secondary" onClick={reset}>Cancelar</button>}</div>
        </form>
        <div className="account-list">
          {addresses.length ? addresses.map(address => <article className="account-row" key={address.id}><div><strong>{address.label}{address.isDefault ? " · Principal" : ""}</strong><p>{address.recipientName} · {address.phone}</p><p>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""} · {address.city}, {address.state} · {address.countryCode}</p></div><div className="button-row"><button className="link-button" onClick={() => startEdit(address)}>Editar</button><button className="link-button" onClick={() => void remove(address.id)}>Eliminar</button></div></article>) : <p className="empty-state">No tienes direcciones guardadas.</p>}
        </div>
        <p><Link href="/cuenta">Volver a mi cuenta</Link></p>
      </section>
    </main>
  );
}
