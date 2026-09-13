"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Metric = { orders: number; customers: number; products: number; openServices: number; revenueInCents: number; pendingPayments: number; lowStock: number };
type Admin = { firstName: string; lastName: string; role: string };
type ResourceItem = Record<string, unknown>;

type ResourceResponse = { items?: ResourceItem[]; error?: string };
const NAV_ITEMS = [
  { key: "orders", label: "Pedidos" },
  { key: "products", label: "Productos" },
  { key: "customers", label: "Clientes" },
  { key: "services", label: "Servicios" },
] as const;

const money = (cents: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cents / 100);
const statusOptions = (resource: string) => resource === "orders"
  ? ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED"]
  : resource === "services"
    ? ["PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"]
    : [];
const resourceIdentifier = (item: ResourceItem) => String(item.order_number ?? item.name ?? item.email ?? item.id ?? "");
const resourceDetail = (item: ResourceItem) => String(item.email ?? item.model ?? item.device_model ?? "");
const resourceStatus = (item: ResourceItem) => String(item.status ?? (item.active === 1 ? "ACTIVE" : "INACTIVE"));

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export default function AdminPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [orders, setOrders] = useState<ResourceItem[]>([]);
  const [resource, setResource] = useState("orders");
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const redirectToLogin = useCallback(() => {
    setAdmin(null);
    setMetrics(null);
    setOrders([]);
    setItems([]);
    router.replace("/admin/login");
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadSession() {
      try {
        const auth = await fetch("/api/admin/auth", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const data = await readJson<{ authenticated: boolean; admin: Admin | null }>(auth);
        if (!active) return;
        if (!auth.ok || !data.authenticated || !data.admin) {
          redirectToLogin();
          return;
        }

        setAdmin(data.admin);
        const dashboard = await fetch("/api/admin/dashboard", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!active) return;
        if (dashboard.status === 401 || dashboard.status === 403) {
          redirectToLogin();
          return;
        }
        if (!dashboard.ok) {
          setError("No se pudo cargar el panel administrativo.");
          return;
        }

        const dashboardData = await readJson<{ metrics: Metric; recentOrders: ResourceItem[] }>(dashboard);
        if (active) {
          setMetrics(dashboardData.metrics);
          setOrders(dashboardData.recentOrders);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : "Error de sesión");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      active = false;
      controller.abort();
    };
  }, [redirectToLogin]);

  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    let active = true;

    async function loadResources() {
      try {
        const response = await fetch(`/api/admin/resources?resource=${encodeURIComponent(resource)}&q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await readJson<ResourceResponse>(response);
        if (!active) return;
        if (response.status === 401 || response.status === 403) {
          redirectToLogin();
          return;
        }
        if (!response.ok) {
          setError(data.error ?? "No se pudo cargar el recurso.");
          return;
        }
        setItems(data.items ?? []);
        setError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : "Error de red");
      }
    }

    void loadResources();
    return () => {
      active = false;
      controller.abort();
    };
  }, [admin, resource, q, redirectToLogin]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function logout() {
    setLogoutLoading(true);
    try {
      await fetch("/api/admin/auth", { method: "DELETE", cache: "no-store", credentials: "same-origin" });
    } finally {
      redirectToLogin();
    }
  }

  async function update(id: string, status: string) {
    setUpdatingId(id);
    setError("");
    try {
      const response = await fetch("/api/admin/resources", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, id, status }),
      });
      if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        return;
      }
      if (!response.ok) {
        const data = await readJson<ResourceResponse>(response);
        setError(data.error ?? "No autorizado o actualización inválida");
        return;
      }
      setItems((current) => current.map((item) => String(item.id) === id ? { ...item, status } : item));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error de red");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) return <main style={{ padding: 32 }}>Verificando sesión…</main>;
  if (!admin) return null;

  const cards = metrics ? [
    ["Pedidos", metrics.orders], ["Clientes", metrics.customers], ["Productos", metrics.products],
    ["Servicios abiertos", metrics.openServices], ["Ingresos", money(metrics.revenueInCents)],
    ["Pagos pendientes", metrics.pendingPayments], ["Stock bajo", metrics.lowStock],
  ] as const : [];

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto", display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div><p>ADMIN · {admin.role}</p><h1>Operaciones</h1><p>{admin.firstName} {admin.lastName}</p></div>
        <button disabled={logoutLoading} onClick={logout}>{logoutLoading ? "Cerrando…" : "Cerrar sesión"}</button>
      </header>

      {metrics && <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        {cards.map(([label, value]) => <article key={label} style={{ padding: 18, border: "1px solid #ddd", borderRadius: 16 }}><small>{label}</small><strong style={{ display: "block", fontSize: 26, marginTop: 8 }}>{value}</strong></article>)}
      </section>}

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {NAV_ITEMS.map((item) => <button key={item.key} disabled={updatingId !== null} onClick={() => setResource(item.key)}>{item.label}</button>)}
      </nav>
      <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p role="alert">{error}</p>}

      <section style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th>Identificador</th><th>Detalle</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>{items.map((item) => {
            const currentStatus = typeof item.status === "string" ? item.status : undefined;
            const options = statusOptions(resource).filter((option) => option !== currentStatus);
            const id = String(item.id);
            return <tr key={id}>
              <td>{resourceIdentifier(item)}</td><td>{resourceDetail(item)}</td><td>{resourceStatus(item)}</td>
              <td>{currentStatus && <select disabled={updatingId !== null} value={currentStatus} onChange={(e) => void update(id, e.target.value)}>
                <option value={currentStatus}>{currentStatus}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>}</td>
            </tr>;
          })}</tbody>
        </table>
      </section>

      <section><h2>Pedidos recientes</h2><ul>{orders.map((order) => <li key={String(order.id)}>{String(order.order_number)} · {String(order.status)} · {money(Number(order.total_in_cents ?? 0))}</li>)}</ul></section>
    </main>
  );
}
