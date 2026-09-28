"use client";

import StoreHeader from "../../components/StoreHeader";
import Link from "next/link";
import { useEffect, useState } from "react";

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  lineTotalInCents: number;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalInCents: number;
  shippingInCents: number;
  totalInCents: number;
  items: OrderItem[];
};

type OrderResponse = { order?: Order; error?: string };

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void params.then(async ({ id }) => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await response.json() as OrderResponse;
        if (!response.ok || !data.order) {
          setError(data.error ?? "Pedido no encontrado");
          return;
        }
        setOrder(data.order);
      } catch {
        setError("No pudimos consultar el pedido.");
      }
    });
  }, [params]);

  if (error) {
    return (
      <main className="store-shell">
        <StoreHeader activeHref="/cuenta" />
        <section className="empty-state">
          <h1>Pedido no disponible.</h1>
          <p>{error}</p>
          <Link href="/cuenta">Volver a mi cuenta</Link>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="store-shell">
        <StoreHeader activeHref="/cuenta" />
        <p>Cargando pedido…</p>
      </main>
    );
  }

  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);

  const paymentPending = order.status === "PENDING_PAYMENT";

  return (
    <main className="store-shell">
      <StoreHeader activeHref="/cuenta" />
      <section className="catalog-hero">
        <p className="eyebrow">Pedido {order.orderNumber}</p>
        <h1>{paymentPending ? "Pedido creado." : "Estado del pedido"}</h1>
        <p>Estado: {order.status}</p>
        {paymentPending && (
          <p>
            El pago se procesa mediante el proveedor seleccionado durante el checkout.
            Si acabas de regresar del proveedor, actualiza esta página para consultar el estado.
          </p>
        )}
      </section>
      <section className="cart-layout">
        <div className="cart-items">
          {order.items.map((item) => (
            <article className="cart-item" key={item.id}>
              <div>
                <h2>{item.productName}</h2>
                <p>Cantidad: {item.quantity}</p>
              </div>
              <strong>{money(item.lineTotalInCents, order.currency)}</strong>
            </article>
          ))}
        </div>
        <aside className="cart-summary">
          <div><span>Subtotal</span><strong>{money(order.subtotalInCents, order.currency)}</strong></div>
          <div><span>Envío</span><strong>{money(order.shippingInCents, order.currency)}</strong></div>
          <div><span>Total</span><strong>{money(order.totalInCents, order.currency)}</strong></div>
          <Link className="button secondary" href="/cuenta">Volver a mi cuenta</Link>
        </aside>
      </section>
    </main>
  );
}
