import Link from "next/link";

type AdminSidebarProps = { active: "repair-orders" | "repair-parts" | "service-types" | "customer-devices" | "technicians" };

const items = [
  ["⌂", "Dashboard", "/admin"],
  ["▣", "Pedidos", "/admin?section=orders"],
  ["▤", "Productos", "/admin?section=products"],
  ["⌘", "Categorías", "/admin?section=categories"],
  ["♙", "Clientes", "/admin?section=customers"],
  ["▱", "Dispositivos de clientes", "/admin/customer-devices"],
  ["◇", "Servicios ofrecidos", "/admin/service-types"],
  ["▧", "Carrusel de inicio", "/admin?section=home-carousel"],
  ["⚙", "Solicitudes", "/admin?section=services"],
] as const;

export default function AdminSidebar({ active }: AdminSidebarProps) {
  return <aside className="admin-sidebar">
    <Link className="admin-brand" href="/admin"><span className="admin-brand-mark">K</span><span><strong>KEVINS</strong><small>Administración</small></span></Link>
    <nav className="admin-nav" aria-label="Secciones administrativas">
      {items.map(([icon, label, href]) => <Link key={label} className={active === "customer-devices" && label === "Dispositivos de clientes" ? "active" : ""} href={href}><span>{icon}</span>{label}</Link>)}
      <Link className={active === "technicians" ? "active" : ""} href="/admin/technicians"><span>♟</span>Técnicos</Link>
      <Link className={active === "repair-orders" ? "active" : ""} href="/admin/repair-orders"><span>◫</span>Órdenes de reparación</Link>
      <Link className={active === "repair-parts" ? "active" : ""} href="/admin/repair-parts"><span>⚙</span>Repuestos de taller</Link>
    </nav>
    <div className="admin-sidebar-footer"><span className="admin-status-dot" /> Sistema operativo</div>
  </aside>;
}
