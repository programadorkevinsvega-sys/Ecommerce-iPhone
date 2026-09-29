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
  | "repair-parts"
  | "payments"
  | "audit"
  | "reviews"
  | "promotions"
  | "settings"
  | "inventory"
  | "notifications"
  | "cms"
  | "seo";

type AdminSidebarProps = { active: AdminSidebarSection };

const items: ReadonlyArray<{
  key: AdminSidebarSection;
  icon: string;
  label: string;
  href: string;
}> = [
  { key: "dashboard", icon: "⌂", label: "Dashboard", href: "/admin" },
  { key: "orders", icon: "▣", label: "Pedidos", href: "/admin/orders" },
  { key: "products", icon: "▤", label: "Productos", href: "/admin/products" },
  { key: "categories", icon: "⌘", label: "Categorías", href: "/admin/categories" },
  { key: "customers", icon: "♙", label: "Clientes", href: "/admin/customers" },
  { key: "customer-devices", icon: "▱", label: "Dispositivos de clientes", href: "/admin/customer-devices" },
  { key: "service-types", icon: "◇", label: "Servicios ofrecidos", href: "/admin/service-types" },
  { key: "home-carousel", icon: "▧", label: "Carrusel de inicio", href: "/admin/home-carousel" },
  { key: "services", icon: "⚙", label: "Solicitudes", href: "/admin/services" },
  { key: "technicians", icon: "♟", label: "Técnicos", href: "/admin/technicians" },
  { key: "users", icon: "♛", label: "Administradores y roles", href: "/admin/users" },
  { key: "repair-orders", icon: "◫", label: "Órdenes de reparación", href: "/admin/repair-orders" },
  { key: "repair-parts", icon: "⚙", label: "Repuestos de taller", href: "/admin/repair-parts" },
  { key: "inventory", icon: "▥", label: "Inventario", href: "/admin/inventory" },
  { key: "payments", icon: "$", label: "Pagos", href: "/admin/payments" },
  { key: "audit", icon: "◌", label: "Auditoría", href: "/admin/audit" },
  { key: "reviews", icon: "★", label: "Reseñas", href: "/admin/reviews" },
  { key: "promotions", icon: "%", label: "Promociones", href: "/admin/promotions" },
  { key: "promotions", icon: "◇", label: "Cupones", href: "/admin/coupons" },
  { key: "promotions", icon: "◆", label: "Campañas", href: "/admin/campaigns" },
  { key: "cms", icon: "▧", label: "CMS", href: "/admin/cms" },
  { key: "cms", icon: "▤", label: "Contenido editorial", href: "/admin/cms/content" },
  { key: "seo", icon: "⌁", label: "SEO", href: "/admin/seo" },
  { key: "settings", icon: "⚙", label: "Configuración", href: "/admin/settings" },
  { key: "notifications", icon: "✉", label: "Notificaciones", href: "/admin/notifications" },
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
