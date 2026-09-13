# Security foundation

## Application

- Security response headers are configured in `apps/web/next.config.ts`.
- API requests are restricted to the same request origin for browser state-changing calls.
- API preflight handling is explicit and rejects disallowed origins before the route executes.
- Every API response receives a validated or generated `X-Request-Id` for tracing.
- API responses are marked `no-store` to avoid accidental caching of customer/admin data.
- Errors should be translated at the presentation boundary; domain errors must not expose infrastructure details.
- Secrets are excluded from Git and documented through `.env.example` only by name.

## Authorization

Admin roles and a server-side authorization policy contract live in `modules/admin/application/Rbac.ts`.

## Abuse protection

The application layer exposes a `RateLimiter` port. Cloudflare WAF/rate-limiting rules remain an edge/platform control and should protect authentication, checkout, payment webhooks and other abuse-sensitive routes.

## Auditability

The application layer exposes an `AuditLogger` port for security-sensitive actions such as role changes, price changes, refunds and service operations.

## Sensitive device data

IMEI/serial information must be treated as private service data: never expose it in public URLs, catalog pages, logs or analytics events. Access should be authorized and auditable.

## Form and input hardening — Security Phase 7

All implemented production forms follow the same boundary contract:

```text
input
  ↓
normalización
  ↓
validación
  ↓
submit
  ↓
manejo seguro del error
```

The shared implementation is `apps/web/lib/inputValidation.ts` and its unit tests are in `apps/web/lib/inputValidation.test.ts`.

Covered surfaces:

- admin login;
- checkout and shipping data;
- product reviews;
- service requests;
- catalog search and filters;
- admin resource search/state controls.

The browser layer adds `required`, `minLength`, `maxLength`, `type`, `inputMode`, `autoComplete`, labels and ARIA metadata where applicable. These constraints are UX/accessibility controls only.

Every sensitive API boundary repeats normalization and validation server-side. Browser `required`, `minLength`, `maxLength`, pattern and type checks are never treated as security authority.

User-controlled values are not echoed directly into error responses. Client presentation uses generic status-aware errors for authentication, authorization, conflicts and invalid input.

Search parameters are normalized and length-bounded before reaching application search. Administrative identifiers are normalized before mutation operations.

Contact page audit: the current `contacto` page is informational and does not expose a submission form or contact-ingestion API, so no unimplemented backend was invented during this phase.

A separate storefront customer-login form was not found in the production route tree; the identified login UI is the admin login and is covered by this phase.

## URL, routing and parameters — Security Phase 8 audit

### Dynamic routes audited

- `/iphone/[slug]`
- `/productos/[slug]` legacy route redirecting internally to `/iphone/[slug]`
- `/orders/[id]`
- `/api/orders/[id]`

### Open redirect audit

No production use of `redirect`, `returnUrl`, `callback`, `next` or a user-controlled destination parameter was found in the audited routing surface. The payment-provider redirects are separately protected by the Phase 6 provider allowlist and HTTPS validation.

The legacy product redirect is internally constructed and does not accept a destination URL. It should additionally validate the route slug before constructing the internal pathname.

### ID manipulation / IDOR

`/api/orders/[id]` does not trust the URL identifier as authorization. It resolves the authenticated `customer_session` server-side and calls `GetOrderForCustomer`, which requires `order.customerId === session.customerId` before returning the order. Changing `/orders/123` to another identifier therefore cannot by itself cross the customer ownership boundary.

The remaining hardening item is early route-parameter validation before repository lookup so malformed identifiers are rejected before the application query.

### Slug injection

Product lookup uses a parameterized D1 query (`slug = ?`), so the `[slug]` value is not interpolated into SQL. The remaining hardening item is strict canonical slug validation before lookup and redirect construction.

### SEO audit

Product metadata is generated dynamically from the server-side product record and currently provides title, description, canonical URL, Open Graph metadata and Product JSON-LD. JSON-LD continues to pass through the existing safe serializer.

Current SEO issue found: `sitemap.ts` only requests the first 48 catalog records, so it does not necessarily expose the complete product catalog. It also emits `/productos/[slug]` for non-Apple products even though `/productos/[slug]` is a legacy redirect to `/iphone/[slug]`. The sitemap should use the canonical `/iphone/[slug]` path and paginate until the catalog total has been exhausted.

`robots.ts` correctly excludes `/admin` and `/api/` and points to `/sitemap.xml`, but both sitemap and robots currently use `example.com` as a fallback when `NEXT_PUBLIC_APP_URL` is absent. Production should use a validated canonical application URL rather than a placeholder domain.

### Phase 8 certification state

**🟡 AUDITED — not yet certified.**

Code-level hardening still required before declaring Phase 8 complete:

1. strict route slug validation before product lookup;
2. strict resource-ID normalization before order lookup;
3. generic server error responses for order retrieval failures;
4. validated canonical application URL for metadata/sitemap/robots;
5. complete sitemap pagination using canonical product paths;
6. tests covering malformed slugs, malformed IDs and canonical SEO output.

## Images and external content — Security Phase 9

### Image surface audited

- `next/image` usage in the catalog and product detail pages;
- product image URLs loaded from the D1 `product_images` table;
- product primary-image fallback loaded from `products.primary_image_url`;
- dynamic Product Open Graph image metadata;
- JSON-LD Product `image` values;
- avatar/image surfaces (no production avatar image field or avatar renderer was found in the audited route/component surface);
- CMS data (no CMS image field is currently accepted or rendered; current CMS input is text/SEO/canonical metadata only);
- payment checkout URLs (these are navigation targets, not image sources, and remain protected by the Phase 6 payment-provider allowlist).

### Dangerous URL schemes

Product images are now restricted at the domain boundary to same-origin asset paths under `/products/`. Absolute external URLs and the schemes `javascript:`, `data:`, `file:` and protocol-relative `//host/...` are rejected. Image query strings and fragments are also rejected to prevent turning an approved asset path into a remote/proxy-style URL.

The existing production seed uses `/products/*.webp` paths, so the new invariant matches the current catalog representation. External image hosting is not required by the current rendering policy.

### Next.js remote image / SSRF review

`apps/web/next.config.ts` now declares `images.remotePatterns: []`, meaning no remote image host is authorized for the Next image optimizer. This is intentional: the application stores and renders same-origin product assets only.

Because no remote host is configured, a database value cannot make the Next image optimizer fetch an arbitrary attacker-controlled server. The CSP also keeps `img-src` limited to `'self'`, `data:` and `blob:`. Together these controls prevent an attacker-controlled absolute image URL from becoming an approved remote image source through `next/image`.

There is currently no `javascript:`, `data:`, `file:` or `http:`/`https:` exception path for product image storage. Payment redirects remain a separate URL-control surface and continue to require HTTPS plus an exact provider hostname allowlist.

### Verification tests

`modules/catalog/domain/Product.test.ts` now covers:

- valid same-origin `/products/...` assets;
- external hosts;
- `javascript:` URLs;
- `data:` URLs;
- `file:` URLs;
- protocol-relative external URLs;
- image query-string and fragment attempts.

### Phase 9 certification state

**🟢 CODE HARDENED — pending CI verification.**

The implementation is complete for the audited production surface, but the phase is not marked fully certified until the repository CI run for the resulting commit passes the normal lint, typecheck, unit-test and production build/deploy gates.
