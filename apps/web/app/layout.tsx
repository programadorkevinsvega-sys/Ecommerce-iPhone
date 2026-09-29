import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { organizationSchema, websiteSchema } from "../../../modules/seo/application/StructuredData";
import { siteConfig } from "../../../modules/seo/application/SeoPolicy";
import { serializeJsonLd } from "../lib/jsonLd";

const seoSite = siteConfig();
const organizationJsonLd = serializeJsonLd(
  organizationSchema({ name: seoSite.name, url: seoSite.origin }),
);
const websiteJsonLd = serializeJsonLd(
  websiteSchema({ name: seoSite.name, url: seoSite.origin }),
);

export const metadata: Metadata = {
  metadataBase: new URL(seoSite.origin),
  title: {
    default: "Ecommerce iPhone",
    template: "%s | Ecommerce iPhone",
  },
  description: "Tienda online de smartphones y servicios para dispositivos móviles.",
  applicationName: "Ecommerce iPhone",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Ecommerce iPhone",
    locale: "es_CO",
    url: seoSite.origin,
    title: "Ecommerce iPhone",
    description: "Tienda online de smartphones y servicios para dispositivos móviles.",
  },
  twitter: {
    card: "summary",
    title: "Ecommerce iPhone",
    description: "Tienda online de smartphones y servicios para dispositivos móviles.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Script id="organization-jsonld" type="application/ld+json">
          {organizationJsonLd}
        </Script>
        <Script id="website-jsonld" type="application/ld+json">
          {websiteJsonLd}
        </Script>
        {children}
      </body>
    </html>
  );
}
