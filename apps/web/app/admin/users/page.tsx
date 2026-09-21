"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import AdminSidebar from "../AdminSidebar";

const ROLES = [
  ["SUPER_ADMIN", "Super administrador"],
  ["ADMIN", "Administrador"],
  ["MANAGER", "Gerente"],
  ["SALES", "Ventas"],
  ["SUPPORT", "Soporte"],
  ["INVENTORY", "Inventario"],
  ["FINANCE", "Finanzas"],
  ["CONTENT_EDITOR", "Editor de contenido"],
] as const;

type AdminUser = {
  id: string;
  email: string;
  role: (typeof ROLES)[number][0];
  firstName: string;
  lastName: string;
  active: boolean;
  lastLoginAt?: string;
};

type FormState = {
  email: string;
  firstName: string;
  lastName: string;
  role: AdminUser["role"];
  password: string;
  active: boolean;
};

const EMPTY: FormState = {
  email: "",
  firstName: "",
  lastName: "",
  role: "ADMIN",
  password: "",
  active: true,
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/users", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401 || response.status === 403) {
      window.location.href = "/admin/login";
      return;
    }
    const data = (await response.json()) as { items?: AdminUser[]; error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron cargar los administradores.");
      return;
    }
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const body = {
      ...form,
      ...(editing ? { id: editing } : {}),
      ...(form.password ? { password: form.password } : {}),
    };
    delete (body as Record<string, unknown>).active;

    const response = await fetch("/api/admin/users", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(editing ? { ...body, active: form.active } : body),
    });

    const data = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? editing
          ? "Usuario administrativo actualizado."
          : "Usuario administrativo creado con sus credenciales."
        : data.error ?? "No se pudo guardar el usuario administrativo.",
    );

    if (response.ok) {
      setForm(EMPTY);
      setEditing(null);
      await load();
    }
    setLoading(false);
  }

  async function toggle(item: AdminUser) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Estado actualizado." : data.error ?? "No se pudo actualizar el estado.");
    if (response.ok) await load();
  }

  function edit(item: AdminUser) {
    setEditing(item.id);
    setForm({
      email: item.email,
      firstName: item.firstName,
      lastName: item.lastName,
      role: item.role,
      password: "",
      active: item.active,
    });
  }

  return (
    <main className="admin-shell">
      <AdminSidebar active="users" />
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Seguridad y acceso</p>
            <h1>Administradores y roles</h1>
            <p>Crea cuentas administrativas y asigna el rol que determina sus permisos.</p>
          </div>
          <Link href="/admin" className="admin-button">Volver</Link>
        </header>

        <section className="admin-workspace">
          <form className="admin-form" onSubmit={save}>
            <h2>{editing ? "Editar cuenta administrativa" : "Crear cuenta administrativa"}</h2>
            <div className="form-grid">
              <label>
                Correo
                <input required type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
              </label>
              <label>
                Nombre
                <input required value={form.firstName} onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))} />
              </label>
              <label>
                Apellido
                <input required value={form.lastName} onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))} />
              </label>
              <label>
                Rol
                <select value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value as AdminUser["role"] }))}>
                  {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                {editing ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
                <input required={!editing} minLength={12} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} />
              </label>
              {editing && (
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))} />
                  Cuenta activa
                </label>
              )}
            </div>
            {message && <p role="status">{message}</p>}
            <div className="modal-actions">
              <button className="admin-button primary" disabled={loading} type="submit">
                {editing ? "Guardar cambios" : "Crear cuenta"}
              </button>
              {editing && (
                <button type="button" className="admin-button" onClick={() => { setEditing(null); setForm(EMPTY); }}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Administrador</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.firstName} {item.lastName}</strong>
                      <span className="table-subtext">{item.email}</span>
                    </td>
                    <td>{ROLES.find(([value]) => value === item.role)?.[1] ?? item.role}</td>
                    <td>{item.active ? "Activo" : "Inactivo"}</td>
                    <td>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString("es-CO") : "Nunca"}</td>
                    <td>
                      <button className="table-action" type="button" onClick={() => edit(item)}>Editar</button>
                      <button className="table-action" type="button" onClick={() => void toggle(item)}>{item.active ? "Desactivar" : "Activar"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <div className="admin-empty"><h3>No hay cuentas administrativas adicionales</h3><p>La primera cuenta SUPER_ADMIN se crea mediante el bootstrap seguro del sistema.</p></div>}
          </div>
        </section>
      </section>
    </main>
  );
}
