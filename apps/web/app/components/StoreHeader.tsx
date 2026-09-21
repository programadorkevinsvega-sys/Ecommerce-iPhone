"use client";

import Link from "next/link";
import type { ReactNode } from "react";

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
  { href: "/contacto", label: "Contacto" },
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
