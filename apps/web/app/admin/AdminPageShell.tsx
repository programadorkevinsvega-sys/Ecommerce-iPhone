import type { ReactNode } from "react";
import type { AdminSidebarSection } from "./AdminSidebar";
import AdminSidebar from "./AdminSidebar";
import AdminPageHeader from "./AdminPageHeader";

type AdminPageShellProps = {
  active: AdminSidebarSection;
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminPageShell({ active, kicker, title, description, actions, children }: AdminPageShellProps) {
  return (
    <main className="admin-shell">
      <AdminSidebar active={active} />
      <section className="admin-content">
        <AdminPageHeader kicker={kicker} title={title} description={description} actions={actions} />
        {children}
      </section>
    </main>
  );
}
