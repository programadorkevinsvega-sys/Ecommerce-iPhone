import Link from "next/link";

export type AdminSidebarSection =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "customers"
  | "services"
  | "home-carousel"
  | "customer-devices"
  | "service-types"
  | "technicians"
  | "users"
  | "repair-orders"
  | "repair-parts";

type AdminSidebarProps = { active: AdminSidebarSection };

const items: ReadonlyArray<{
  key: AdminSidebarSection;
  icon: string;
  label: string;
  href: string;
}> = [
  { key: "dashboard", icon: "⌂", label: "Dashboard", href: "/admin" },
  { key: "orders", icon: "▣", label: "Pedidos", href: "/admin?section=orders" },
  { key: "products", icon: "▤", label: "Productos", href: "/admin?section=products" },
  { key: "categories", icon: "⌘", label: "Categorías", href: "/admin?section=categories" },
  { key: "customers", icon: "♙", label: "Clientes", href: "/admin?section=customers" },
  { key: "customer-devices", icon: "▱", label: "Dispositivos de clientes", href: "/admin/customer-devices" },
  { key: "service-types", icon: "◇", label: "Servicios ofrecidos", href: "/admin/service-types" },
  { key: "home-carousel", icon: "▧", label: "Carrusel de inicio", href: "/admin?section=home-carousel" },
  { key: "services", icon: "⚙", label: "Solicitudes", href: "/admin?section=services" },
  { key: "technicians", icon: "♟", label: "Técnicos", href: "/admin/technicians" },
  { key: "users", icon: "♛", label: "Administradores y roles", href: "/admin/users" },
  { key: "repair-orders", icon: "◫", label: "Órdenes de reparación", href: "/admin/repair-orders" },
  { key: "repair-parts", icon: "⚙", label: "Repuestos de taller", href: "/admin/repair-parts" },
];

export default function AdminSidebar({ active }: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin">
        <span className="admin-brand-mark">K</span>
        <span>
          <strong>KEVINS</strong>
          <small>Administración</small>
        </span>
      </Link>
      <nav className="admin-nav" aria-label="Secciones administrativas">
        {items.map((item) => (
          <Link
            key={item.key}
            className={active === item.key ? "active" : ""}
            href={item.href}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <span className="admin-status-dot" /> Sistema operativo
      </div>
    </aside>
  );
}
