"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import NotificationBell from "./NotificationBell";

type StoreNavigationProps = {
  activeHref?: string | undefined;
  children?: ReactNode | undefined;
};

type StoreHeaderProps = StoreNavigationProps;

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/catalog", label: "Catálogo" },
  { href: "/servicios", label: "Servicios" },
  { href: "/reparaciones", label: "Consultar reparación" },
  { href: "/blog", label: "Blog" },\n  { href: "/faq", label: "Preguntas frecuentes" },\n  { href: "/contacto", label: "Contacto" },
  { href: "/cart", label: "Carrito" },
  { href: "/cuenta", label: "Mi cuenta" },
] as const;

function isActive(href: string, activeHref?: string) {
  if (!activeHref) return false;
  if (href === "/") return activeHref === "/";
  return activeHref === href || activeHref.startsWith(`${href}/`);
}

export function StoreNavigation({ activeHref, children }: StoreNavigationProps) {
  return (
    <nav aria-label="Principal">
      {NAV_ITEMS.map((item) => (
        <Link
          href={item.href}
          key={item.href}
          aria-current={isActive(item.href, activeHref) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
      {children}
      <NotificationBell scope="customer" href="/cuenta/notificaciones" />
    </nav>
  );
}

export default function StoreHeader({ activeHref }: StoreHeaderProps) {
  return (
    <header className="store-header">
      <Link href="/" className="brand-mark">
        Ecommerce iPhone
      </Link>
      {activeHref === undefined ? (
        <StoreNavigation />
      ) : (
        <StoreNavigation activeHref={activeHref} />
      )}
    </header>
  );
}
