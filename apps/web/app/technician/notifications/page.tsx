"use client";

import { useEffect, useState } from "react";
import NotificationInbox from "../../components/NotificationInbox";
import TechnicianHeader from "../TechnicianHeader";

type Technician = { firstName: string; email: string };

export default function TechnicianNotificationsPage() {
  const [technician, setTechnician] = useState<Technician | null>(null);

  useEffect(() => {
    void fetch("/api/technician/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { authenticated?: boolean; technician?: Technician | null };
        if (!response.ok || !data.authenticated) {
          window.location.href = "/technician/login";
          return;
        }
        setTechnician(data.technician ?? null);
      })
      .catch(() => {
        window.location.href = "/technician/login";
      });
  }, []);

  return (
    <main className="technician-shell">
      <TechnicianHeader firstName={technician?.firstName} email={technician?.email} />
      <section className="technician-page-head">
        <NotificationInbox
          scope="technician"
          title="Notificaciones técnicas."
          subtitle="Asignaciones, cambios de órdenes y alertas operativas vinculadas con tu identidad técnica."
        />
      </section>
    </main>
  );
}
