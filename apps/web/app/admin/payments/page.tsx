"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPageShell from "../AdminPageShell";
import AdminPanel from "../AdminPanel";
import AdminSectionHeading from "../AdminSectionHeading";
import AdminToolbar from "../AdminToolbar";
import AdminTable from "../AdminTable";
import AdminEmptyState from "../AdminEmptyState";
import AdminLoadingState from "../AdminLoadingState";

type Payment = {
  id: string;
  orderId: string;
  customerId: string;
  provider: string;
  providerReference: string;
  providerTransactionId?: string;
  status: string;
  amountInCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

type PaymentDetails = {
  payment: Payment & { checkoutUrl?: string };
  refunds: unknown[];
  ledger: unknown[];
};

const STATUSES = ["", "CREATED", "PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];
const PROVIDERS = ["", "WOMPI", "STRIPE", "MERCADOPAGO", "PAYPAL", "BINANCE_PAY"];

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);

export default function PaymentsPage() {
  const [items, setItems] = useState<Payment[]>([]);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [selected, setSelected] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);
    return params.toString();
  }, [status, provider]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payments?" + query, { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as { items?: Payment[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los pagos.");
      setItems(data.items ?? []);
      setSelected(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los pagos.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/admin/payments/" + encodeURIComponent(id), { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as PaymentDetails & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo consultar el pago.");
      setSelected(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo consultar el pago.");
    } finally {
      setBusy("");
    }
  }

  async function operate(id: string, action: "refund" | "void") {
    const label = action === "refund" ? "reembolsar" : "anular";
    if (!window.confirm("¿Confirmas " + label + " este pago?")) return;
    const idempotencyKey = crypto.randomUUID();
    setBusy(id + action);
    setError("");
    try {
      const response = await fetch("/api/admin/payments/" + encodeURIComponent(id) + "/" + action, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "La operación de pago no pudo completarse.");
      await load();
      await open(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La operación de pago no pudo completarse.");
    } finally {
      setBusy("");
    }
  }

  return (
    <AdminPageShell
      active="payments"
      kicker="Finanzas"
      title="Pagos"
      description="Consulta transacciones reales y ejecuta operaciones autorizadas sobre pagos existentes."
    >
      {error && <p className="admin-error" role="alert">{error}</p>}

      <AdminPanel>
        <AdminToolbar>
          <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map((value) => <option key={value} value={value}>{value || "Todos"}</option>)}</select></label>
          <label>Proveedor<select value={provider} onChange={(event) => setProvider(event.target.value)}>{PROVIDERS.map((value) => <option key={value} value={value}>{value || "Todos"}</option>)}</select></label>
          <button className="admin-button" type="button" onClick={() => void load()}>Actualizar</button>
        </AdminToolbar>

        {loading ? (
          <AdminLoadingState label="Cargando pagos…" />
        ) : (
          <AdminTable
            headers={["Pago", "Pedido", "Proveedor", "Importe", "Estado", "Creado", "Acciones"]}
            empty={!items.length ? <AdminEmptyState title="No hay pagos para los filtros actuales" /> : undefined}
          >
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.id}</strong><span className="table-subtext">{item.providerReference}</span></td>
                <td>{item.orderId}</td>
                <td>{item.provider}</td>
                <td>{money(item.amountInCents, item.currency)}</td>
                <td>{item.status}</td>
                <td>{new Date(item.createdAt).toLocaleString("es-CO")}</td>
                <td><button className="table-action" type="button" disabled={Boolean(busy)} onClick={() => void open(item.id)}>Ver detalle</button></td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminPanel>

      {selected && (
        <section className="admin-workspace admin-page-grid">
          <AdminPanel>
            <AdminSectionHeading kicker="Detalle" title={"Pago " + selected.payment.id} meta={<span>{selected.payment.status}</span>} />
            <dl className="admin-definition-list">
              <div><dt>Proveedor</dt><dd>{selected.payment.provider}</dd></div>
              <div><dt>Referencia</dt><dd>{selected.payment.providerReference}</dd></div>
              <div><dt>Transacción</dt><dd>{selected.payment.providerTransactionId ?? "—"}</dd></div>
              <div><dt>Pedido</dt><dd>{selected.payment.orderId}</dd></div>
              <div><dt>Cliente</dt><dd>{selected.payment.customerId}</dd></div>
              <div><dt>Importe</dt><dd>{money(selected.payment.amountInCents, selected.payment.currency)}</dd></div>
            </dl>
            <div className="modal-actions">
              <button className="admin-button" type="button" disabled={Boolean(busy)} onClick={() => void operate(selected.payment.id, "void")}>Anular</button>
              <button className="admin-button danger" type="button" disabled={Boolean(busy)} onClick={() => void operate(selected.payment.id, "refund")}>Reembolsar</button>
            </div>
          </AdminPanel>

          <AdminPanel>
            <AdminSectionHeading title="Refunds" />
            <pre className="admin-json">{JSON.stringify(selected.refunds, null, 2)}</pre>
            <AdminSectionHeading title="Ledger" />
            <pre className="admin-json">{JSON.stringify(selected.ledger, null, 2)}</pre>
          </AdminPanel>
        </section>
      )}
    </AdminPageShell>
  );
}
