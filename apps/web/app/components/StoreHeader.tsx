"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";

type StoreNavigationProps = {
  activeHref?: string | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
};

type StoreHeaderProps = StoreNavigationProps;

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/catalog", label: "Catálogo" },
  { href: "/servicios", label: "Servicios" },
  { href: "/reparaciones", label: "Consultar reparación" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "Preguntas frecuentes" },
  { href: "/contacto", label: "Contacto" },
  { href: "/cart", label: "Carrito" },
  { href: "/cuenta", label: "Mi cuenta" },
] as const;

function isActive(href: string, activeHref?: string) {
  if (!activeHref) return false;
  if (href === "/") return activeHref === "/";
  return activeHref === href || activeHref.startsWith(`${href}/`);
}

function NavigationLinks({
  activeHref,
  onNavigate,
}: {
  activeHref?: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          href={item.href}
          key={item.href}
          aria-current={isActive(item.href, activeHref) ? "page" : undefined}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function StoreNavigation({
  activeHref,
  children,
  className,
}: StoreNavigationProps) {
  return (
    <nav aria-label="Principal" className={className}>
      <NavigationLinks activeHref={activeHref} />
      {children}
      <NotificationBell scope="customer" href="/cuenta/notificaciones" />
    </nav>
  );
}

export default function StoreHeader({ activeHref }: StoreHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 800) setMenuOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const currentHref = activeHref;

  return (
    <header className="store-header">
      <Link href="/" className="brand-mark" onClick={() => setMenuOpen(false)}>
        Ecommerce iPhone
      </Link>

      <div className="store-header-desktop">
        <StoreNavigation
          activeHref={currentHref}
          className="store-navigation-desktop"
        />
      </div>

      <div className="store-header-mobile-actions">
        <Link
          href="/cart"
          className="store-mobile-cart"
          aria-label="Carrito"
          onClick={() => setMenuOpen(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h6.9a2 2 0 0 0 1.9-1.4L20 8H7"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <circle cx="10" cy="19" r="1.2" fill="currentColor" />
            <circle cx="17" cy="19" r="1.2" fill="currentColor" />
          </svg>
        </Link>

        <button
          type="button"
          className="store-mobile-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="mobile-store-menu"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-store-menu" id="mobile-store-menu">
          <div className="mobile-store-menu-header">
            <span>Menú</span>
            <button
              type="button"
              className="mobile-store-menu-close"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
            >
              ×
            </button>
          </div>

          <nav aria-label="Navegación móvil" className="mobile-store-menu-links">
            <NavigationLinks
              activeHref={currentHref}
              onNavigate={() => setMenuOpen(false)}
            />
            <Link
              href="/cuenta/notificaciones"
              onClick={() => setMenuOpen(false)}
            >
              Notificaciones
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
