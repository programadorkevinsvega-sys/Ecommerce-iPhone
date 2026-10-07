import Link from "next/link";
import { redirect } from "next/navigation";
import NotificationInbox from "../../components/NotificationInbox";
import { StoreNavigation } from "../../components/StoreHeader";
import { currentCustomerId } from "../../../lib/customerSession";

export default async function CustomerNotificationsPage() {
  const customerId = await currentCustomerId();
  if (!customerId) {
    redirect("/cuenta/login?next=%2Fcuenta%2Fnotificaciones");
  }

  return (
    <main className="account-page notification-account-page">
      <header className="account-topbar">
        <Link className="brand-mark" href="/">Ecommerce iPhone</Link>
        <StoreNavigation activeHref="/cuenta" />
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
