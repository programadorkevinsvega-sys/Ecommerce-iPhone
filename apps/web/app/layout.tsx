import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ecommerce iPhone",
    template: "%s | Ecommerce iPhone",
  },
  description: "Tienda online de smartphones y servicios para dispositivos móviles.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
