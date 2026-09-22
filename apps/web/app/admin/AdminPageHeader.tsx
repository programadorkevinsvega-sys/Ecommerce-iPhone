import type { ReactNode } from "react";
import NotificationBell from "../components/NotificationBell";

type AdminPageHeaderProps = {
  kicker: string;
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
};

export default function AdminPageHeader({ kicker, title, description, actions }: AdminPageHeaderProps) {
  return (
    <header className="admin-topbar">
      <div>
        <p className="admin-kicker">{kicker}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="admin-toolbar-actions">
        <NotificationBell scope="admin" href="/admin/notifications" />
        {actions}
      </div>
    </header>
  );
}
