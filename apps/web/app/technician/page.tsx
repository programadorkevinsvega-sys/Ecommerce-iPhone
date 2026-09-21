"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Technician = {
  firstName: string;
  lastName: string;
  email: string;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  problemReported: string;
  device: { brand: string; model: string };
};

export default function TechnicianHome() {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const session = await fetch("/api/technician/auth/session", { cache: "no-store" });
      const sessionData = await session.json() as {
        authenticated: boolean;
        technician: Technician | null;
      };

      if (!session.ok || !sessionData.authenticated) {
        window.location.href = "/technician/login";
        return;
      }

      setTechnician(sessionData.technician);

      const response = await fetch("/api/technician/orders", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.status === 401) {
        window.location.href = "/technician/login";
        return;
      }

      const data = await response.json() as { items?: Order[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudieron cargar las órdenes.");
        return;
      }

      setOrders(data.items ?? []);
    })();
  }, []);

  async function logout() {
    await fetch("/api/technician/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    window.location.href = "/technician/login";
  }

  return (
    <main className="technician-shell">
      <header className="technician-header">
        <div>
          <p className="eyebrow">Área técnica</p>
          <h1>Hola{technician ? ", " + technician.firstName : ""}.</h1>
          <p>Gestiona únicamente las órdenes asignadas a tu identidad técnica.</p>
        </div>
        <div>
          <Link href="/technician/orders" className="button secondary">Órdenes</Link>
          <Link href="/technician/devices" className="button secondary">Dispositivos</Link>
          <Link href="/technician/profile" className="button secondary">Mi perfil</Link>
          <button className="button secondary" onClick={() => void logout()}>Salir</button>
        </div>
      </header>

      {error && <p role="alert">{error}</p>}

      <section className="technician-grid">
        <article className="technician-workbench">
          <p className="eyebrow">Operación</p>
          <h2>{orders.length} órdenes asignadas</h2>
          <p>Las órdenes se cargan desde la identidad técnica actual y nunca desde la sesión administrativa.</p>
          <Link href="/technician/orders" className="button primary">Abrir órdenes</Link>
        </article>

        <article className="technician-workbench">
          <p className="eyebrow">Identidad</p>
          <h2>Cuenta técnica independiente</h2>
          <p>{technician?.email ?? "Sesión técnica activa."}</p>
          <p>Esta área utiliza technician_session y no concede acceso al panel /admin.</p>
        </article>
      </section>
    </main>
  );
}
