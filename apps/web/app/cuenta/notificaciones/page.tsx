"use client";

import Link from "next/link";
import NotificationInbox from "../../components/NotificationInbox";
import { StoreNavigation } from "../../components/StoreHeader";

export default function CustomerNotificationsPage() {
  return (
    <main className="account-page notification-account-page">
      <header className="account-topbar">
        <Link className="brand-mark" href="/">Ecommerce iPhone</Link>
        <StoreNavigation activeHref="/cuenta">
          <Link href="/cuenta">Mi cuenta</Link>
        </StoreNavigation>
      </header>
      <div className="notification-account-wrap">
        <NotificationInbox
          scope="customer"
          title="Tus notificaciones."
          subtitle="Actualizaciones de pedidos, servicios y comunicaciones importantes de tu cuenta."
        />
      </div>
    </main>
  );
}
