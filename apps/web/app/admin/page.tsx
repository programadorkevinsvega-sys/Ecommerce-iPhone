"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Metric = {
  orders: number;
  customers: number;
  products: number;
  openServices: number;
  revenueInCents: number;
  pendingPayments: number;
  lowStock: number;
};
type Admin = { firstName: string; lastName: string; role: string };
type NavItem = { key: string; label: string };
type MetricCard = { label: string; value: string | number };
type ResourceItem = Record<string, unknown>;

const money = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);

const NAV_ITEMS: NavItem[] = [
  { key: "orders", label: "Pedidos" },
  { key: "products", label: "Productos" },
  { key: "customers", label: "Clientes" },
  { key: "services", label: "Servicios" },
];

function statusOptions(resource: string): string[] {
  switch (resource) {
    case "orders":
      return ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED"];
    case "services":
      return ["PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"];
    default:
      return [];
  }
}

function resourceIdentifier(item: ResourceItem): string {
  return String(item.order_number ?? item.name ?? item.email ?? item.id ?? "");
}

function resourceDetail(item: ResourceItem): string {
  return String(item.email ?? item.model ?? item.device_model ?? "");
}

function resourceStatus(item: ResourceItem): string {
  return String(item.status ?? (item.active === 1 ? "ACTIVE" : "INACTIVE"));
}

export default function AdminPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [orders, setOrders] = useState<ResourceItem[]>([]);
  const [resource, setResource] = useState<string>("orders");
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const auth = await fetch("/api/admin/auth");
      const a = (await auth.json()) as {
        authenticated: boolean;
        admin: Admin | null;
      };
      if (!a.authenticated) {
        router.replace("/admin/login");
        return;
      }

      setAdmin(a.admin);
      const d = await fetch("/api/admin/dashboard");
      if (d.ok) {
        const x = (await d.json()) as {
          metrics: Metric;
          recentOrders: ResourceItem[];
        };
        setMetrics(x.metrics);
        setOrders(x.recentOrders);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!admin) return;

    fetch(`/api/admin/resources?resource=${resource}&q=${encodeURIComponent(q)}`).then(
      async (r) => {
        const d = (await r.json()) as {
          items?: ResourceItem[];
          error?: string;
        };

        if (!r.ok) {
          setError(d.error ?? "Error");
          return;
        }

        setItems(d.items ?? []);
        setError("");
      },
    );
  }, [admin, resource, q]);

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.replace("/admin/login");
  }

  async function update(id: string, status: string) {
    const r = await fetch("/api/admin/resources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource, id, status }),
    });

    if (r.ok) {
      setItems((current) =>
        current.map((item) => (String(item.id) === id ? { ...item, status } : item)),
      );
    } else {
      setError("No autorizado o actualización inválida");
    }
  }

  if (!admin) {
    return <main style={{ padding: 32 }}>Cargando panel…</main>;
  }

  const cards: MetricCard[] = metrics
    ? [
        { label: "Pedidos", value: metrics.orders },
        { label: "Clientes", value: metrics.customers },
        { label: "Productos", value: metrics.products },
        { label: "Servicios abiertos", value: metrics.openServices },
        { label: "Ingresos", value: money(metrics.revenueInCents) },
        { label: "Pagos pendientes", value: metrics.pendingPayments },
        { label: "Stock bajo", value: metrics.lowStock },
      ]
    : [];

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 1400,
        margin: "0 auto",
        display: "grid",
        gap: 24,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <p>ADMIN · {admin.role}</p>
          <h1>Operaciones</h1>
          <p>
            {admin.firstName} {admin.lastName}
          </p>
        </div>
        <button onClick={logout}>Cerrar sesión</button>
      </header>

      {metrics && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
            gap: 12,
          }}
        >
          {cards.map((card) => (
            <article
              key={card.label}
              style={{
                padding: 18,
                border: "1px solid #ddd",
                borderRadius: 16,
              }}
            >
              <small>{card.label}</small>
              <strong
                style={{ display: "block", fontSize: 26, marginTop: 8 }}
              >
                {card.value}
              </strong>
            </article>
          ))}
        </section>
      )}

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {NAV_ITEMS.map((item) => (
          <button key={item.key} onClick={() => setResource(item.key)}>
            {item.label}
          </button>
        ))}
      </nav>

      <input
        placeholder="Buscar…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {error && <p role="alert">{error}</p>}

      <section style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Identificador</th>
              <th>Detalle</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const currentStatus =
                typeof item.status === "string" ? item.status : undefined;
              const options = statusOptions(resource).filter(
                (option) => option !== currentStatus,
              );

              return (
                <tr key={String(item.id)}>
                  <td>{resourceIdentifier(item)}</td>
                  <td>{resourceDetail(item)}</td>
                  <td>{resourceStatus(item)}</td>
                  <td>
                    {currentStatus && (
                      <select
                        value={currentStatus}
                        onChange={(e) => update(String(item.id), e.target.value)}
                      >
                        <option value={currentStatus}>{currentStatus}</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Pedidos recientes</h2>
        <ul>
          {orders.map((order) => (
            <li key={String(order.id)}>
              {String(order.order_number)} · {String(order.status)} ·{" "}
              {money(Number(order.total_in_cents ?? 0))}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
