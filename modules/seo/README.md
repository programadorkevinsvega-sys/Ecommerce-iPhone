# SEO bounded context

Owns SEO metadata, canonical URLs, redirects, sitemap inputs, structured-data models and indexability policy.

## Implemented in Fase 09

- Deterministic production origin: https://iphone.jnmtortas.com, overridable by explicit NEXT_PUBLIC_APP_URL.
- Typed canonical/indexability policy.
- Centralized metadata adapter with Open Graph, Twitter cards, robots and canonical.
- D1-backed route SEO overrides with 60-second cache and explicit revalidation after admin writes.
- D1-backed 301/410 redirect manager.
- Redirects are applied after a real public 404 in the Cloudflare Worker, so normal successful requests do not incur a redirect-table lookup.
- Product JSON-LD with Offer, real price/availability/condition and only real approved reviews.
- Organization, WebSite and BreadcrumbList JSON-LD.
- Article JSON-LD for published blog posts.
- FAQ JSON-LD only when published FAQ content exists.
- Dynamic sitemap based on public catalog/CMS data and indexability/canonical overrides.
- Production-safe robots.txt.
- Server-rendered public services page.
- Noindex layouts for administrative, account, checkout, cart, order, technician and private lookup/request surfaces.
- Protected SEO administration API and UI for metadata, indexability, canonical, OG image and redirects.
- Production SEO verification script: pnpm verify:phase09:production.

## Intentionally not generated

- hreflang is not emitted until the application has real locale variants and reciprocal localized URLs. Generating language alternates without real localized content would create false SEO signals.
- LocalBusiness is not emitted because the current public data model does not expose verified business address/contact/opening-hours data suitable for structured data.