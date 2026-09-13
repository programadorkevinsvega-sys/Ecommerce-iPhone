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
