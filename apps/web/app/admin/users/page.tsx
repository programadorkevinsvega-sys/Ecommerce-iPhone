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

type PermissionItem = {
  permission: string;
  state: "inherit" | "grant" | "deny";
  effective: boolean;
  roleGranted: boolean;
};

const PERMISSION_LABELS: Record<string, string> = {
  "dashboard:read": "Ver dashboard",
  "products:read": "Ver productos",
  "products:write": "Gestionar productos",
  "categories:read": "Ver categorías",
  "categories:write": "Gestionar categorías",
  "orders:read": "Ver pedidos",
  "orders:write": "Gestionar pedidos",
  "customers:read": "Ver clientes",
  "customers:write": "Gestionar clientes",
  "services:read": "Ver solicitudes",
  "services:write": "Gestionar solicitudes",
  "repair_orders:read": "Ver órdenes de reparación",
  "repair_orders:write": "Gestionar órdenes de reparación",
  "refunds:create": "Crear reembolsos",
  "payments:void": "Anular pagos",
  "payments:read": "Ver pagos",
  "service_types:write": "Gestionar servicios ofrecidos",
  "admins:manage": "Gestionar administradores",
  "audit:read": "Ver auditoría",
  "inventory:read": "Ver inventario",
  "inventory:write": "Gestionar inventario",
  "reviews:write": "Gestionar reseñas",
  "promotions:write": "Gestionar promociones",
  "cms:write": "Gestionar contenido",
  "settings:write": "Gestionar configuración",
  "technicians:manage": "Gestionar técnicos",
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
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const loadRolePermissions = async (role: AdminUser["role"]) => {
    setPermissionsLoading(true);
    try {
      const response = await fetch(`/api/admin/permissions/catalog?role=${encodeURIComponent(role)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { items?: PermissionItem[]; error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "No se pudieron cargar los permisos del rol.");
        return;
      }
      setPermissions(data.items ?? []);
    } finally {
      setPermissionsLoading(false);
    }
  };

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
    void loadRolePermissions(EMPTY.role);
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const body = editing
      ? {
          id: editing,
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        }
      : {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          password: form.password,
        };

    const response = await fetch("/api/admin/users", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as { error?: string; id?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo guardar el usuario administrativo.");
      setLoading(false);
      return;
    }

    if (!editing && data.id) {
      const overrides = permissions
        .filter((item) => item.state !== "inherit")
        .map((item) => ({ permission: item.permission, granted: item.state === "grant" }));
      if (overrides.length) {
        const permissionResponse = await fetch(`/api/admin/users/${encodeURIComponent(data.id)}/permissions`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ overrides }),
        });
        if (!permissionResponse.ok) {
          const permissionData = (await permissionResponse.json()) as { error?: string };
          setMessage(`Administrador creado con el rol base. No se pudieron aplicar los permisos individuales: ${permissionData.error ?? "error de autorización"}.`);
        } else {
          setMessage("Administrador creado con sus credenciales y permisos configurados.");
        }
      } else {
        setMessage("Administrador creado con sus credenciales y los permisos base del rol.");
      }
    } else {
      setMessage("Usuario administrativo actualizado.");
      await loadPermissions(editing!);
    }

    await load();
    if (!editing) {
      setForm(EMPTY);
      await loadRolePermissions(EMPTY.role);
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

  async function loadPermissions(id: string) {
    setPermissionsLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/permissions`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { items?: PermissionItem[]; error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "No se pudieron cargar los permisos.");
        setPermissions([]);
        return;
      }
      setPermissions(data.items ?? []);
    } finally {
      setPermissionsLoading(false);
    }
  }

  function edit(item: AdminUser) {
    setEditing(item.id);
    setPermissions([]);
    setForm({
      email: item.email,
      firstName: item.firstName,
      lastName: item.lastName,
      role: item.role,
      password: "",
      active: item.active,
    });
    void loadPermissions(item.id);
  }

  async function savePermissions() {
    if (!editing) return;
    const overrides = permissions
      .filter((item) => item.state !== "inherit")
      .map((item) => ({ permission: item.permission, granted: item.state === "grant" }));
    const response = await fetch(`/api/admin/users/${encodeURIComponent(editing)}/permissions`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ overrides }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron guardar los permisos.");
      return false;
    }
    setMessage("Permisos actualizados.");
    await loadPermissions(editing);
    return true;
  }

  return (
    <main className="admin-shell">
      <AdminSidebar active="users" />
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Seguridad y acceso</p>
            <h1>Administradores y roles</h1>
            <p>Crea cuentas administrativas, asigna un rol base y configura permisos específicos por cuenta.</p>
          </div>
          <Link href="/admin" className="admin-button">Volver</Link>
        </header>

        <section className="admin-workspace admin-users-grid">
          <div className="admin-page-panel">
          <form className="admin-form" onSubmit={save}>
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">Cuenta</p>
                <h2>{editing ? "Editar administrador" : "Crear administrador"}</h2>
              </div>
              {editing && <button className="admin-button" type="button" onClick={() => { setEditing(null); setForm(EMPTY); setPermissions([]); }}>Nuevo</button>}
            </div>
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
                <select
                  value={form.role}
                  onChange={(e) => {
                    const role = e.target.value as AdminUser["role"];
                    setForm((v) => ({ ...v, role }));
                    if (!editing) void loadRolePermissions(role);
                  }}
                >
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
            <section className="admin-permissions-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Autorización</p>
                  <h2>Permisos de la cuenta</h2>
                </div>
                <span className="muted">
                  {editing ? "Rol base + ajustes individuales." : "Se aplican al crear la cuenta."}
                </span>
              </div>
              {permissionsLoading ? (
                <p>Cargando permisos…</p>
              ) : form.role === "SUPER_ADMIN" ? (
                <p className="form-help">SUPER_ADMIN dispone de todos los permisos y sus permisos individuales están protegidos.</p>
              ) : (
                <>
                  <p className="form-help">Heredar usa el permiso definido por el rol. Permitir o Denegar crea un ajuste específico para esta cuenta.</p>
                  <div className="permission-grid">
                    {permissions.map((item) => (
                      <label className="permission-row" key={item.permission}>
                        <span>
                          <strong>{PERMISSION_LABELS[item.permission] ?? item.permission}</strong>
                          <small>{item.permission} · base: {item.roleGranted ? "Activo" : "Denegado"} · efectivo: {item.effective ? "Activo" : "Denegado"}</small>
                        </span>
                        <select
                          value={item.state}
                          onChange={(event) =>
                            setPermissions((current) =>
                              current.map((permission) =>
                                permission.permission === item.permission
                                  ? {
                                      ...permission,
                                      state: event.target.value as PermissionItem["state"],
                                      effective:
                                        event.target.value === "grant"
                                          ? true
                                          : event.target.value === "deny"
                                            ? false
                                            : permission.roleGranted,
                                    }
                                  : permission,
                              ),
                            )
                          }
                        >
                          <option value="inherit">Heredar del rol</option>
                          <option value="grant">Permitir</option>
                          <option value="deny">Denegar</option>
                        </select>
                      </label>
                    ))}
                  </div>
                  {editing && <div className="modal-actions"><button type="button" className="admin-button primary" onClick={() => void savePermissions()}>Guardar permisos</button></div>}
                </>
              )}
            </section>
            {message && <p role="status">{message}</p>}
            <div className="modal-actions">
              <button className="admin-button primary" disabled={loading} type="submit">
                {editing ? "Guardar cambios" : "Crear cuenta"}
              </button>
              {editing && (
                <button type="button" className="admin-button" onClick={() => { setEditing(null); setForm(EMPTY); setPermissions([]); }}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
          </div>

          <div className="admin-page-panel admin-page-table-panel">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">Cuentas</p>
                <h2>Administradores registrados</h2>
              </div>
              <span className="muted">{items.length} cuentas</span>
            </div>
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
            {!items.length && <div className="admin-empty"><span>♛</span><h3>No hay cuentas administrativas adicionales</h3><p>La primera cuenta SUPER_ADMIN se crea mediante el bootstrap seguro del sistema.</p></div>}
          </div>
          </div>
        </section>
      </section>
    </main>
  );
}
