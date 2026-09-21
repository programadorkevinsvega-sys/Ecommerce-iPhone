"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/technician", label: "Inicio" },
  { href: "/technician/orders", label: "Órdenes" },
  { href: "/technician/devices", label: "Dispositivos" },
  { href: "/technician/profile", label: "Mi perfil" },
] as const;

export default function TechnicianHeader({ firstName, email }: { firstName?: string; email?: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/technician/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    window.location.href = "/technician/login";
  }

  return (
    <header className="technician-nav">
      <Link href="/technician" className="technician-brand">
        <span className="technician-brand-mark">E</span>
        <span><strong>Ecommerce iPhone</strong><small>Área técnica</small></span>
      </Link>
      <nav className="technician-nav-links" aria-label="Navegación técnica">
        {ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/technician" && pathname.startsWith(item.href + "/"));
          return <Link href={item.href} key={item.href} className={active ? "active" : undefined}>{item.label}</Link>;
        })}
      </nav>
      <div className="technician-nav-user">
        <div className="technician-user-copy"><strong>{firstName || "Técnico"}</strong><span>{email || "Sesión técnica activa"}</span></div>
        <button type="button" className="technician-logout" onClick={() => void logout()}>Salir</button>
      </div>
    </header>
  );
}